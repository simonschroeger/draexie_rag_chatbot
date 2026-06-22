#!/usr/bin/env python3
import time, sys, httpx

URL = "http://localhost:8000/admin/rebuild-status"
BAR_WIDTH = 45

def render(s: dict) -> str:
    already_done = s.get("skipped_already_done", 0)
    updated      = s["updated"]
    remaining    = s["total"]          # chunks still needing descriptions
    dupes        = s["skipped_duplicate"]
    running      = s["running"]

    grand_total  = already_done + remaining
    completed    = already_done + updated
    pct          = completed / grand_total if grand_total else 1.0

    fill = int(pct * BAR_WIDTH)
    bar  = "█" * fill + "░" * (BAR_WIDTH - fill)
    state = "⏳" if running else "✅"

    return (
        f"\r{state} [{bar}] {completed}/{grand_total} "
        f"| new: {updated}  dupes: {dupes}  already done: {already_done}  "
    )

while True:
    try:
        s = httpx.get(URL, timeout=3).json()
        sys.stdout.write(render(s))
        sys.stdout.flush()
        if not s["running"]:
            print()
            break
    except Exception as e:
        sys.stdout.write(f"\rWaiting for backend... ({e})")
        sys.stdout.flush()
    time.sleep(2)
