#!/usr/bin/env python3
"""Independent consistency checks for planning fixtures, not the production engine."""
from __future__ import annotations
import json
from pathlib import Path
from zoneinfo import ZoneInfo
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
CASES = {c["id"]: c for c in json.loads((ROOT / "testing/forecast_test_vectors.json").read_text())["cases"]}


def total_accounts(accounts):
    return sum(v if isinstance(v, int) else v["minor"] for v in accounts.values())


def main():
    failures=[]
    def check(cond,msg):
        if not cond: failures.append(msg)

    c=CASES["F001_basic_before_payday"]
    before=sum(v for v in c["accounts"].values())+sum(x["amountMinor"] for x in c["occurrences"] if x["date"]<c["nextIncomeDate"])
    check(before==c["expected"]["minimumBeforeIncomeMinor"],"F001 minimum")
    check(before-c["protectedFloorMinor"]==c["expected"]["availableBeforeNextIncomeMinor"],"F001 available")
    check(before+58500==c["expected"]["closingOnNextIncomeDateMinor"],"F001 closing")

    c=CASES["F002_pending_replaced_by_posted"]
    check(total_accounts(c["accounts"])-5000==c["expected"]["closingMinor"],"F002 closing")

    c=CASES["F003_transfer_is_net_neutral"]
    start=total_accounts(c["accounts"]); end=start+sum(x["amountMinor"] for x in c["occurrences"])
    check(end==c["expected"]["consolidatedClosingMinor"],"F003 consolidated")

    c=CASES["F004_actual_overrides_expected_rent"]
    actual=c["occurrences"][0]["amountMinor"]; exp=c["expectations"][0]["amountMinor"]
    check(total_accounts(c["accounts"])+actual==c["expected"]["closingMinor"],"F004 closing")
    check(actual-exp==c["expected"]["varianceMinor"],"F004 variance")

    c=CASES["F005_uncertain_overtime_excluded"]
    allowed=[x for x in c["occurrences"] if x.get("certainty")!="inferred"]
    before=total_accounts(c["accounts"])+sum(x["amountMinor"] for x in allowed if x["date"]<c["nextIncomeDate"])
    check(before-c["protectedFloorMinor"]==c["expected"]["availableBeforeNextIncomeMinor"],"F005 available")

    c=CASES["F006_debt_payment_boundary"]
    base=total_accounts(c["accounts"])+sum(x["amountMinor"] for x in c["occurrences"])
    max_out=base-c["protectedFloorMinor"]
    check(max_out==c["expected"]["maximumScenarioOutflowMinor"],"F006 max")

    c=CASES["F009_multi_currency_no_silent_sum"]
    gbp=c["accounts"]["gbp"]["minor"]; eur=c["accounts"]["eur"]["minor"]
    check(gbp+round(eur*float(c["expected"]["withRate"]["rate"]))==c["expected"]["withRate"]["consolidatedGBPMinor"],"F009 fx")

    c=CASES["F010_dst_recurrence_local_time"]
    z=ZoneInfo(c["rule"]["timeZone"])
    for expected in c["expected"]["occurrences"]:
        local=datetime.fromisoformat(expected["local"]).replace(tzinfo=z)
        check(local.astimezone(ZoneInfo("UTC")).isoformat().replace("+00:00","Z")==expected["utc"],f"F010 {expected['local']}")

    for cid in ["F011_positive_budget_rollover","F012_no_budget_rollover"]:
        c=CASES[cid]; rem=c["budget"]["allocationMinor"]-c["budget"]["postedSpendingMinor"]
        check(rem==c["expected"]["currentRemainingMinor"],f"{cid} remainder")

    for cid in ["F014_posted_reversal","F018_hypothetical_never_commits"]:
        c=CASES[cid]
        if cid.startswith("F014"):
            check(total_accounts(c["accounts"])+sum(x["amountMinor"] for x in c["occurrences"])==c["expected"]["closingMinor"],"F014")
        else:
            check(total_accounts(c["accounts"])+c["scenario"]["change"]["amountMinor"]==c["expected"]["scenarioClosingMinor"],"F018")

    c=CASES["F015_minimum_balance_occurs_mid_period"]
    position=total_accounts(c["accounts"]); minimum=position
    for x in c["occurrences"]:
        position+=x["amountMinor"]; minimum=min(minimum,position)
    check(minimum==c["expected"]["minimumBeforeIncomeMinor"],"F015 minimum")
    check(minimum-c["protectedFloorMinor"]==c["expected"]["availableBeforeNextIncomeMinor"],"F015 available")

    c=CASES["F016_same_day_tie_break_protected_first"]
    ordered=sorted(c["occurrences"],key=lambda x:(x["date"],0 if x.get("protected") and x["amountMinor"]<0 else 1,x["id"]))
    pos=total_accounts(c["accounts"]); low=pos
    for x in ordered: pos+=x["amountMinor"]; low=min(low,pos)
    check(low==c["expected"]["lowestMinor"] and pos==c["expected"]["closingMinor"],"F016")

    c=CASES["F017_floor_is_user_policy_not_advice"]
    after=total_accounts(c["accounts"])+sum(x["amountMinor"] for x in c["occurrences"])
    for v in c["variants"]:
        check(after-v["floorMinor"]==v["expectedAvailableMinor"],f"F017 floor {v['floorMinor']}")

    if failures:
        print(json.dumps({"ok":False,"failures":failures},indent=2)); return 1
    print(json.dumps({"ok":True,"checkedCases":14,"failures":[]},indent=2)); return 0

if __name__=="__main__": raise SystemExit(main())
