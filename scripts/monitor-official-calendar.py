#!/usr/bin/env python3
"""Monitor titles on the Russian OFFICIAL publication portal, fail closed.

The portal doesn't provide a guaranteed stable machine-readable API.
This is a best-effort index scan, NOT automated interpretation of new decrees.
New potential acts go to academic-office review; no calendar dates are changed.
"""
import datetime as dt
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"public"/"official-calendar-monitor.json"
BASE="https://publication.pravo.gov.ru"
EXPECTED=["0001202509240023","0001202609180037"]
DOCUMENTS=[
 {"id":"0001202509240023","name":"Постановление Правительства РФ от 24.09.2025 № 1466","year":2026,
  "url":BASE+"/document/0001202509240023"},
 {"id":"0001202609180037","name":"Постановление Правительства РФ от 17.09.2026 № 1187","year":2027,
  "url":BASE+"/document/0001202609180037"}
]
RELEVANT=re.compile(r"перенос.{0,24}выходн|нерабоч.{0,24}празднич|производственн.{0,15}календар|внесении изменений.{0,110}(?:1187|1466)",re.I|re.S)
ID=re.compile(r"Номер опубликования\s*:\s*(000120\d{14})")

class PageText(HTMLParser):
 def __init__(self):
  super().__init__();self.parts=[]
 def handle_data(self,data):
  if data.strip():self.parts.append(data.strip())
 def text(self):
  return " ".join(self.parts)

def extract_candidates(page:str,published_date:str)->list[dict]:
 parser=PageText()
 parser.feed(page)
 chunks=re.split(r"(?=Постановление Правительства Российской Федерации от|Федеральный закон от)",html.unescape(parser.text()))
 output=[]
 for chunk in chunks:
  if not RELEVANT.search(chunk[:360]):continue
  m=ID.search(chunk)
  if not m:continue
  publication=m.group(1)
  if publication in EXPECTED:continue
  title=re.sub(r"\s+"," ",chunk[:360]).strip()
  output.append({"id":publication,"title":title[:330],"date":published_date,
    "url":BASE+"/document/"+publication,"status":"requires_review",
    "explanation":"Публикация может влиять на выходные дни; требуется проверить полный текст и даты действия"})
 return output

def load_previous()->dict:
 try:
  saved=json.loads(DEST.read_text(encoding="utf-8"))
  return saved if saved.get("version")==1 else {}
 except (ValueError,OSError):return {}

def monitor(today:dt.date|None=None)->dict:
 today=today or dt.date.today()
 previous=load_previous()
 last=previous.get("lastSuccessfulDate")
 try:earliest=dt.date.fromisoformat(last)-dt.timedelta(days=2) if last else today-dt.timedelta(days=13)
 except (ValueError,TypeError):earliest=today-dt.timedelta(days=13)
 earliest=max(earliest,today-dt.timedelta(days=29))
 known={x["id"]:x for x in previous.get("candidates",[]) if isinstance(x,dict) and x.get("id")}
 failures=[];completed=0
 for i in range((today-earliest).days+1):
  date=earliest+dt.timedelta(days=i)
  date_str=date.strftime("%d.%m.%Y")
  url=BASE+"/documents?"+urllib.parse.urlencode({"date":date_str,"periodType":"day","pageSize":200,"index":1})
  try:
   req=urllib.request.Request(url,headers={"User-Agent":"College-Schedule-legal-monitor/1.0","Accept":"text/html"})
   with urllib.request.urlopen(req,timeout=12) as response:
    if response.status!=200:raise ValueError("HTTP "+str(response.status))
    page=response.read(1_500_000).decode("utf-8","replace")
   if "ОФИЦИАЛЬНОЕ ОПУБЛИКОВАНИЕ" not in page.upper() and "Номер опубликования" not in page:
    raise ValueError("Не удалось проверить структуру страницы официального портала")
   for candidate in extract_candidates(page,date.isoformat()):known[candidate["id"]]=candidate
   completed+=1
  except Exception as exc:failures.append(date.isoformat()+": "+str(exc)[:150])
 # A candidate is never automatically interpreted as an approved transfer.
 status="ok" if not failures else "partial" if completed else "unavailable"
 output={"version":1,"source":"publication.pravo.gov.ru","checkedAt":dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z"),
   "status":status,"daysChecked":completed,"daysFailed":len(failures),
   "lastSuccessfulDate":today.isoformat() if not failures else previous.get("lastSuccessfulDate"),
   "officialDocuments":DOCUMENTS,"candidates":list(known.values())[-100:],
   "failures":failures[:4]}
 return output

def main():
 result=monitor()
 DEST.parent.mkdir(parents=True,exist_ok=True)
 # Stable info still records monitoring health, but never hides previous candidate alerts.
 DEST.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("Official publication scan:",result["status"],"days:",result["daysChecked"],
       "candidates:",len(result["candidates"]))
 if result["failures"]:print("Official portal failures (review):",*result["failures"],sep="\n  ")
 return 0  # A portal outage is reported in the user interface, not disguised as successful verification.

if __name__=="__main__":
 raise SystemExit(main())
