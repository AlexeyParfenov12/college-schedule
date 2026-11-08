#!/usr/bin/env python3
"""Public repo issue for calendar discrepancies, with optional SMTP delivery."""
import hashlib,json,os,smtplib,urllib.request
from pathlib import Path
from email.message import EmailMessage
ROOT=Path(__file__).resolve().parents[1]
TITLE="[College Schedule] Контроль производственного календаря — учебная часть"
def request(method,url,token,data=None):
 payload=json.dumps(data,ensure_ascii=False).encode() if data is not None else None
 req=urllib.request.Request(url,data=payload,method=method,headers={
  "Authorization":"Bearer "+token,"Accept":"application/vnd.github+json",
  "Content-Type":"application/json","User-Agent":"College-Schedule-calendar-alert"})
 with urllib.request.urlopen(req,timeout=20) as response:return json.loads(response.read().decode())
def report(snapshot):
 errors=snapshot.get("discrepancies",[])
 monitor=snapshot.get("officialMonitor") or {}
 candidates=monitor.get("candidates",[])
 status=monitor.get("status","unavailable")
 lines=["Уведомление для администратора учебной части.","",
        "Расхождения и новые документы НЕ изменяют занятия автоматически.","",
        "## Расхождения между API и нормативными правилами"]
 if not errors:lines.append("Зафиксированных расхождений нет.")
 for row in errors:
  lines.extend(["",f"### {row['date']} · {row['workweek']}-дневная неделя",
    row["explanation"],f"- Справочный API: {row['apiCode']}; применённое правило: {row['legalCode']}",
    f"- Нормативный источник: [{row['documentTitle']}]({row['officialUrl']})",
    "- Необходимо проверить применение нормативного акта"])
 lines.extend(["","## Официальные публикации, требующие проверки"])
 if not candidates:lines.append("Новых кандидатов на последней доступной проверке не обнаружено.")
 for row in candidates:lines.append(f"- [{row['title']}]({row['url']}) ({row['date']})")
 lines.extend(["",f"## Статус мониторинга официального портала: {status}"])
 if status!="ok":lines.append("Проверка официального портала неполная или недоступна. Нельзя утверждать, что новых актов нет.")
 lines.extend(["","Откройте учебный календарь College Schedule, раздел «Центр календаря учебной части».",
  "","Внимание: GitHub Issue уведомляет подписчиков репозитория, но не является личной доставкой реальному администратору колледжа. Для адресной доставки задайте email и SMTP-секреты."])
 body="\n".join(lines)
 digest=hashlib.sha256(json.dumps({"errors":errors,"candidates":candidates,"status":status},
  sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:18]
 return body,digest,len(errors)+len(candidates)+(status!="ok")
def send_email(body,digest):
 destination=os.getenv("ACADEMIC_ADMIN_EMAIL","").strip()
 host=os.getenv("CALENDAR_SMTP_HOST","").strip()
 sender=os.getenv("CALENDAR_SMTP_FROM","").strip()
 if not (destination and host and sender):
  print("Email not configured: calendar alerts remain in GitHub and in-app center.")
  return
 msg=EmailMessage();msg["From"]=sender;msg["To"]=destination
 msg["Subject"]=TITLE+" ("+digest+")";msg.set_content(body)
 port=int(os.getenv("CALENDAR_SMTP_PORT") or "465")
 if port==465:
  smtp=smtplib.SMTP_SSL(host,port,timeout=18)
 else:
  smtp=smtplib.SMTP(host,port,timeout=18);smtp.starttls()
 with smtp:
  if os.getenv("CALENDAR_SMTP_USERNAME"):
   smtp.login(os.environ["CALENDAR_SMTP_USERNAME"],os.environ["CALENDAR_SMTP_PASSWORD"])
  smtp.send_message(msg)
 print("Sent via configured SMTP gateway; inbox delivery is not guaranteed.")
def main():
 snapshot=json.loads((ROOT/"public"/"production-calendar.json").read_text(encoding="utf-8"))
 body,digest,count=report(snapshot)
 if not count:
  print("No alerts to publish");return 0
 token=os.getenv("GITHUB_TOKEN","");repository=os.getenv("GITHUB_REPOSITORY","")
 if not (token and repository):
  print("GitHub issue API credentials unavailable; in-app alerts remain active.")
  return 0
 marker="<!-- calendar-alert-digest:"+digest+" -->"
 url="https://api.github.com/repos/"+repository+"/issues"
 try:
  issues=request("GET",url+"?state=open&per_page=100",token)
  existing=next((x for x in issues if x.get("title")==TITLE and "pull_request" not in x),None)
  if existing and marker in (existing.get("body") or ""):
   print("Alert content unchanged: no duplicate issue or email.")
   return 0
  text=body+"\n\n"+marker
  if existing:
   request("PATCH",url+"/"+str(existing["number"]),token,{"body":text})
   print("Updated calendar alert issue #"+str(existing["number"]))
  else:
   issue=request("POST",url,token,{"title":TITLE,"body":text})
   print("Created calendar alert issue #"+str(issue["number"]))
  try:send_email(body,digest)
  except Exception as exc:print("Optional email delivery failed: "+str(exc)[:180])
 except Exception as exc:
  print("GitHub notification failed: "+str(exc)[:180]);return 1
 return 0
if __name__=="__main__":raise SystemExit(main())
