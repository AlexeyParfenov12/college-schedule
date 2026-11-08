"""Pure, network-free checks of official monitor and discrepancy explanations."""
import importlib.util
from pathlib import Path
import unittest

HERE=Path(__file__).resolve().parent
def script(name):
 spec=importlib.util.spec_from_file_location(name.replace("-","_"),HERE/name)
 module=importlib.util.module_from_spec(spec)
 spec.loader.exec_module(module)
 return module
monitor=script("monitor-official-calendar.py")
sync=script("sync-production-calendar.py")
notify=script("notify-calendar-admin.py")

class OfficialCalendarChecks(unittest.TestCase):
 def test_candidate_detection_uses_exact_official_publication_id(self):
  page='''<html><h1>ОФИЦИАЛЬНОЕ ОПУБЛИКОВАНИЕ</h1>
  <p>Постановление Правительства Российской Федерации от 25.09.2027 № 1234
  "О переносе выходных дней в 2028 году"</p>
  Номер опубликования: 0001202709260123 Дата опубликования: 26.09.2027</html>'''
  candidates=monitor.extract_candidates(page,"2027-09-26")
  self.assertEqual(len(candidates),1)
  self.assertEqual(candidates[0]["id"],"0001202709260123")
  self.assertEqual(candidates[0]["url"],
   "https://publication.pravo.gov.ru/document/0001202709260123")
 def test_known_documents_are_not_misreported_as_new(self):
  page='''<p>Постановление Правительства Российской Федерации от 17.09.2026 № 1187
  "О переносе выходных дней в 2027 году"
  Номер опубликования: 0001202609180037</p>'''
  self.assertEqual(monitor.extract_candidates(page,"2026-09-18"),[])
 def test_legal_disagreement_contains_date_mode_reason_and_original_document(self):
  row=sync.explain_discrepancy("2026-12-31: six, справочный API=0, постановление=1")
  self.assertEqual(row["workweek"],6)
  self.assertIn("1466",row["documentTitle"])
  self.assertIn("government.ru",row["officialUrl"])
  self.assertIn("Справочный",row["explanation"])
 def test_november_4_is_statutory_holiday(self):
  row=sync.explain_discrepancy("2026-11-04: six, справочный API=0, постановление=1")
  self.assertIn("стать",row["documentTitle"].lower())
  self.assertTrue(row["officialUrl"].startswith("https://mintrud.gov.ru/"))
 def test_issue_report_includes_official_link_and_is_stable_across_runs(self):
  row=sync.explain_discrepancy("2027-12-31: six, справочный API=0, постановление=1")
  snapshot={"discrepancies":[row],"officialMonitor":{"status":"unavailable","candidates":[]}}
  body,fingerprint,count=notify.report(snapshot)
  self.assertIn(row["officialUrl"],body)
  self.assertIn(row["explanation"],body)
  self.assertGreater(count,0)
  self.assertEqual(fingerprint,notify.report(snapshot)[1])

if __name__=="__main__":
 unittest.main()
