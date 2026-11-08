#!/usr/bin/env python3
"""Weekly read-only reconciliation of Russian production-calendar day types.

Source: isdayoff.ru API (reference service, not an official decree registry).
The baked-in 2026/27 legal transfer rules remain the authority on conflicts.
Never touch lesson data; publish only a complete validated 5/6-day snapshot.
"""
import calendar
import datetime as dt
import json
import os
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "production-calendar.json"
TODAY = dt.date.today()
# Cover this year and the next two calendar years, including the next academic year.
YEARS = sorted({2026, 2027, TODAY.year, TODAY.year + 1, TODAY.year + 2})
TIMEOUT_SECONDS = 18


def request_year(year: int, six: bool) -> str:
    url = f"https://isdayoff.ru/api/getdata?year={year}&cc=ru&pre=1&sd={1 if six else 0}"
    req = urllib.request.Request(url, headers={"User-Agent": "College-Schedule-calendar-sync/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as response:
        if response.status != 200:
            raise ValueError(f"Unexpected HTTP {response.status} for {year}")
        body = response.read(2048).decode("ascii").strip()
    expected = 366 if calendar.isleap(year) else 365
    if len(body) != expected or not set(body) <= set("012"):
        raise ValueError(f"Invalid or incomplete day flags for {year}, six={six}")
    sundays, off, saturdays = 0, 0, 0
    start = dt.date(year, 1, 1)
    for index, flag in enumerate(body):
        date = start + dt.timedelta(days=index)
        if date.weekday() == 6:
            sundays += 1
            if flag != "1":
                raise ValueError(f"Invalid Sunday {date}: {flag}")
        if date.weekday() == 5 and flag == "1":
            saturdays += 1
        if flag == "1":
            off += 1
    if sundays < 52 or not 55 <= off <= (125 if six else 145):
        raise ValueError(f"Implausible non-working-day total {year}: {off}")
    if not six and (off < 95 or saturdays < 45):
        raise ValueError(f"Expected a five-day working week for {year}")
    if body[0] != "1":
        raise ValueError(f"January 1 must be a public holiday for {year}")
    return body


def code(flags: str, year: int, month: int, day: int) -> str:
    index = (dt.date(year, month, day) - dt.date(year, 1, 1)).days
    return flags[index]


def reconcile_legal_anchors(records: dict) -> list[str]:
    """Prefer the text of known government decrees on discrepancies with reference APIs.

    Only a *single expected state* is corrected; ambiguous 0/2 combinations are accepted
    as working or shortened. This deliberately does not certify unpublished future years.
    """
    checks = [
        (2026, 12, 31, "1", "1"),
        (2026, 11, 4, "1", "1"),
        (2027, 2, 22, "1", "02"),
        (2027, 2, 20, "02", "02"),
        (2027, 11, 5, "1", "02"),
        (2027, 12, 31, "1", "1"),
    ]
    warnings = []
    for year, month, day, five, six in checks:
        item = records.get(str(year))
        if not item:
            raise ValueError("Missing confirmed calendar year " + str(year))
        for attr, expected in [("five", five), ("six", six)]:
            flags = item[attr]
            date = f"{year}-{month:02}-{day:02}"
            index = (dt.date(year, month, day) - dt.date(year, 1, 1)).days
            actual = flags[index]
            if actual not in expected:
                if len(expected) != 1:
                    raise ValueError(f"Reference API disagrees with known working status: {date} {attr}={actual}")
                item[attr] = flags[:index] + expected + flags[index+1:]
                warning = f"{date}: {attr}, справочный API={actual}, постановление={expected}"
                warnings.append(warning)
                print("Normative override: " + warning, flush=True)
    return warnings



LEGAL_DOCUMENTS = {
    "holiday": {
        "title": "Статья 112 Трудового кодекса РФ (разъяснение Минтруда)",
        "url": "https://mintrud.gov.ru/labour/relationship/351",
    },
    "2026": {
        "title": "Постановление Правительства РФ от 24.09.2025 № 1466",
        "url": "https://static.government.ru/media/files/4jeB8hNKm69ggOa9yDiYOli6YoAyM21i.pdf",
        "officialPublication": "https://publication.pravo.gov.ru/document/0001202509240023",
    },
    "2027": {
        "title": "Постановление Правительства РФ от 17.09.2026 № 1187",
        "url": "https://publication.pravo.gov.ru/document/0001202609180037",
        "officialPublication": "https://publication.pravo.gov.ru/document/0001202609180037",
    },
}
def explain_discrepancy(warning: str) -> dict:
    import re
    match = re.match(r"(\d{4}-\d{2}-\d{2}): (five|six), справочный API=([012]), постановление=([012])", warning)
    if not match:
        raise ValueError("Не удалось разобрать расхождение: " + warning)
    date,mode,reference,official=match.groups()
    is_holiday = date.endswith("-11-04")
    document=LEGAL_DOCUMENTS["holiday" if is_holiday else date[:4]]
    kind = "федеральный нерабочий праздничный день" if is_holiday else "перенос выходного дня"
    reason=(f"{date}: {kind}. Справочный isdayoff.ru считает день "
            f"{'рабочим' if reference in ('0','2') else 'нерабочим'}, "
            f"а подтверждённое правило — {'нерабочим' if official=='1' else 'рабочим'}. "
            "Поэтому в College Schedule сохранено нормативное правило, а не ответ API.")
    return {"id":f"federal-{date}-{mode}","date":date,"workweek":5 if mode=="five" else 6,
            "apiCode":reference,"legalCode":official,"explanation":reason,
            "documentTitle":document["title"],"officialUrl":document["url"],
            "publicationUrl":document.get("officialPublication",document["url"]),
            "status":"review_required","scope":"federal"}

def main() -> int:
    previous = {}
    if DEST.exists():
        try:
            old = json.loads(DEST.read_text(encoding="utf-8"))
            if old.get("version") == 1 and old.get("provider") == "isdayoff.ru":
                previous = old.get("years", {})
        except (ValueError, OSError):
            pass
    records = {}
    for year in YEARS:
        try:
            records[str(year)] = {"five": request_year(year, False), "six": request_year(year, True)}
            print(f"{year}: retrieved two working-week regimes", flush=True)
        except Exception as error:
            if str(year) in previous:
                records[str(year)] = previous[str(year)]
                print(f"{year}: retained previous valid snapshot ({error})", flush=True)
            elif year in (2026, 2027):
                print(f"ERROR: Cannot verify mandatory year {year}: {error}", file=sys.stderr)
                return 1
            else:
                print(f"{year}: not published or unavailable ({error}), using local legal baseline", flush=True)
    try:
        warnings = reconcile_legal_anchors(records)
    except ValueError as error:
        print(f"ERROR: {error}. Existing snapshot will remain untouched.", file=sys.stderr)
        return 1
    discrepancies = [explain_discrepancy(warning) for warning in warnings]
    official_monitor_path=ROOT/"public"/"official-calendar-monitor.json"
    official_monitor=None
    if official_monitor_path.exists():
        try:
            official_monitor=json.loads(official_monitor_path.read_text(encoding="utf-8"))
        except (ValueError,OSError):
            official_monitor=None
    DEST.parent.mkdir(parents=True, exist_ok=True)
    snapshot = {
        "version": 1,
        "provider": "isdayoff.ru",
        "checkedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "years": records,
        "warnings": warnings,
        "discrepancies": discrepancies,
        "officialMonitor": official_monitor,
    }
    # Avoid rewrite on rapid successive runs while recording a new check every day.
    if DEST.exists():
        try:
            previous_data = json.loads(DEST.read_text(encoding="utf-8"))
            if (previous_data.get("years") == records
                and previous_data.get("discrepancies") == discrepancies
                and previous_data.get("officialMonitor") == official_monitor
                and previous_data.get("checkedAt", "")[:10] == snapshot["checkedAt"][:10]):
                print("Already checked today; no changes.")
                return 0
        except (OSError, ValueError):
            pass
    DEST.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Published validated day statuses; remaining future-year transfers are provisional.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
