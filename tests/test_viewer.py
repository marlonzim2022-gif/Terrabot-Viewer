"""Local browser tests; synthetic catalogs never reach the public Viewer."""
import base64
import copy
import json
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
from threading import Thread
import unittest

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
GIF="R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"


def catalog():
    counts={"completed":1,"wins":0,"losses":1,"endings":{"win":0,"death":0,"timeout":0,"decision_limit":1,"other":0}}
    run={"id":"tw-local-test","schema":"terrabot-run-v1","created_at":"2026-10-16T12:00:00Z",
         "code":{"commit":"a"*40,"version":"Nova versão"},"model":{"format":"unavailable","sha256":None},
         "config":{"seed":1,"task_id":1},"goal_criterion":"flag-contact-v1",
         "episodes":{"training":counts,"evaluation":counts},"errors":[],
         "stages":{p:{"state":"succeeded","code":None} for p in ("training","evaluation","recording")}}
    run["stages"]["publication"]={"state":"submitted","code":None}
    return [{"id":run["id"],"label":"Nova versão","metrics":{"Holdout":0},"evaluation_note":"Zero vitórias é resultado válido.",
             "run":run,"replays":[{"file":"game.gif.b64","encoding":"base64-gif","label":"Tentativa sem vitória",
             "description":"Replay de avaliação","views":[{"id":"game","label":"Visão do jogo","file":"game.gif.b64"},
             {"id":"ai","label":"Visão da IA","file":"ai.gif.b64","parts":["ai.part1","ai.part2"]}]}]},
            {"id":"v9","label":"V9 histórico","metrics":{"Modelo":0.25},"evaluation_note":"Nota histórica preservada.",
             "replays":[{"file":"old.gif","label":"Gravação antiga"}]}]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass


class ViewerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=ROOT))
        Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}/'
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(executable_path=os.environ.get('TERRABOT_BROWSER') or shutil.which('chromium'),
                                                  headless=True,args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.data=catalog();self.catalog_failure=False;self.media_failure=False
        self.context=self.browser.new_context(viewport={"width":390,"height":844})
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        def manifest(route):
            if self.catalog_failure: route.fulfill(status=503,body='Unavailable')
            else: route.fulfill(content_type='application/json',body=json.dumps(self.data))
        def media(route):
            if self.media_failure: route.fulfill(status=404,body='Missing');return
            path=route.request.url.rsplit('/',1)[-1]
            if path=='old.gif': route.fulfill(content_type='image/gif',body=base64.b64decode(GIF))
            else:
                content=GIF[:len(GIF)//2] if path=='ai.part1' else GIF[len(GIF)//2:] if path=='ai.part2' else GIF
                route.fulfill(content_type='text/plain',body=content)
        self.page.route('**/manifest.json*',manifest)
        self.page.route('**/media/**',media)
        self.page.route('**/receipts/**',lambda route:route.fulfill(content_type='application/json',body=json.dumps({
            'schema':'terrabot-publication-proof-v1','id':'tw-local-test','state':'verified',
            'package_sha256':'b'*64,'result_commit':'c'*40})))

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])

    def load(self,suffix=''):
        self.page.goto(self.url+suffix)
        self.page.locator('#version option').first.wait_for(state='attached')

    def test_zero_wins_both_views_and_shareable_link_restore_selection(self):
        self.load();self.page.locator('#video').wait_for(state='visible')
        self.assertIn('0 vitórias',self.page.locator('#run-summary').inner_text())
        self.page.wait_for_function("document.querySelector('#execution-status').textContent.includes('Publicação: Verificada')")
        self.page.select_option('#view','ai')
        self.page.locator('#video').wait_for(state='visible')
        url=self.page.locator('#share').get_attribute('href')
        self.assertIn('view=ai',url)
        self.page.goto(url)
        self.page.wait_for_function("document.querySelector('#view').value==='ai'")
        self.assertEqual(self.page.locator('#version').input_value(),'tw-local-test')

    def test_failed_run_without_recording_remains_in_history(self):
        self.data[0]['replays']=[]
        self.data[0]['run']['stages']['training']={'state':'failed','code':'RuntimeError'}
        self.load()
        self.assertIn('Treinamento: Falhou',self.page.locator('#execution-status').inner_text())
        self.assertIn('Não há GIF',self.page.locator('#empty').inner_text())
        self.assertFalse(self.page.locator('#video').is_visible())
        self.assertIn('Falha em etapa',self.page.locator('#version option').first.inner_text())
        self.data[0]['run']['stages']['training']={'state':'succeeded','code':None}
        self.data[0]['run']['stages']['evaluation']={'state':'interrupted','code':'KeyboardInterrupt'}
        self.page.click('#refresh')
        self.page.wait_for_function("document.querySelector('#version option').textContent.includes('Interrompido')")
        self.assertIn('Avaliação: Interrompido',self.page.locator('#execution-status').inner_text())

    def test_historical_raw_gif_and_notes_still_work(self):
        self.load('?experiment=v9')
        self.page.locator('#video').wait_for(state='visible')
        self.assertIn('Resultado histórico',self.page.locator('#run-summary').inner_text())
        self.assertEqual(self.page.locator('#evaluation-note').inner_text(),'Nota histórica preservada.')
        self.assertFalse(self.page.locator('#view-switch').is_visible())

    def test_refresh_recovers_from_error_without_duplicate_options(self):
        self.catalog_failure=True
        self.page.goto(self.url)
        self.page.wait_for_function("document.querySelector('#catalog-status').textContent.includes('Não foi possível')")
        self.catalog_failure=False
        self.page.click('#refresh');self.page.locator('#version option').first.wait_for(state='attached')
        self.page.click('#refresh')
        self.page.wait_for_function("document.querySelector('#catalog-status').textContent.includes('Atualizado')")
        self.assertEqual(self.page.locator('#version option').count(),2)

    def test_comparison_warns_about_incompatible_criteria(self):
        self.load();self.page.select_option('#compare','v9')
        self.assertIn('Comparação descritiva',self.page.locator('#comparison').inner_text())
        self.assertIn('0/1',self.page.locator('#comparison').inner_text())
        self.assertIn('compare=v9',self.page.url)

    def test_media_error_is_explained_without_destroying_run_record(self):
        self.media_failure=True;self.load()
        self.page.wait_for_function("document.querySelector('#status').textContent==='Gravação indisponível'")
        self.assertIn('não está disponível',self.page.locator('#empty').inner_text())
        self.assertIn('Treinamento:',self.page.locator('#execution-status').inner_text())

    def test_phone_desktop_and_untrusted_labels(self):
        self.data[0]['label']='<img src=x onerror="window.bad=1">'
        self.load()
        for width in (390,1280):
            self.page.set_viewport_size({'width':width,'height':900})
            self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))
        self.assertFalse(self.page.evaluate('Boolean(window.bad)'))
        self.page.locator('#refresh').focus()
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'refresh')

    def test_invalid_publication_proof_does_not_claim_verification(self):
        self.page.route('**/receipts/**',lambda route:route.fulfill(content_type='application/json',body='{"state":"verified"}'))
        self.load()
        self.page.wait_for_function("document.querySelector('#execution-status').textContent.includes('confirmação final pendente')")
        self.assertEqual(self.page.locator('.stage-status[data-state=verified]').count(),0)


if __name__=='__main__': unittest.main()
