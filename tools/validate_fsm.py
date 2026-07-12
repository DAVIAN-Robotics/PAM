"""Structural checks on docs/static/data/pam-fsm.json.

Catches transcription errors that would otherwise render as plausible-looking
but wrong rules on the page.
"""
import json
import pathlib
import sys

DATA = pathlib.Path(__file__).resolve().parent.parent / "docs" / "static" / "data" / "pam-fsm.json"
DAY_IDS = ["day1", "day2", "day3", "day4", "day5", "routine-change"]

errors: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        errors.append(msg)


def rule_key(rule: dict) -> str:
    """A rule's identity is its action - the reflector broadens triggers, but
    an action string is stable across days."""
    return rule["action"]


def transition_key(t: dict) -> tuple:
    """A transition's identity is (from, to, label)."""
    return (t["from"], t["to"], t["label"])


def main() -> int:
    days = json.loads(DATA.read_text())["days"]
    check([d["id"] for d in days] == DAY_IDS, f"day ids must be {DAY_IDS}")

    by_id = {d["id"]: d for d in days}

    # State desc must be identical on every day a given state id appears.
    desc_by_state: dict[str, str] = {}

    for day in days:
        ids = [s["id"] for s in day["states"]]
        check(len(ids) == len(set(ids)), f"{day['id']}: duplicate state id")
        check(set(day["rules"]) == set(ids),
              f"{day['id']}: rules keys {sorted(day['rules'])} != states {sorted(ids)}")
        for t in day["transitions"]:
            check(t["from"] in ids, f"{day['id']}: transition from unknown state {t['from']}")
            check(t["to"] in ids, f"{day['id']}: transition to unknown state {t['to']}")
        for s in day["states"]:
            prev_desc = desc_by_state.get(s["id"])
            if prev_desc is None:
                desc_by_state[s["id"]] = s["desc"]
            else:
                check(s["desc"] == prev_desc,
                      f"{day['id']}: state {s['id']} desc '{s['desc']}' "
                      f"differs from earlier desc '{prev_desc}'")
        for state, rules in day["rules"].items():
            actions = [r["action"] for r in rules]
            check(len(actions) == len(set(actions)),
                  f"{day['id']}/{state}: duplicate action among rules "
                  f"(rule_key collisions would silently drop a rule)")
            for r in rules:
                check(bool(r["triggers"]), f"{day['id']}/{state}: rule with no trigger")
                check(r["action"].endswith("."), f"{day['id']}/{state}: action missing period")
                for t in r["triggers"]:
                    check(not t["text"].endswith("."),
                          f"{day['id']}/{state}: trigger '{t['text']}' has a trailing period "
                          f"(paper triggers carry no terminal punctuation)")
                if day["id"] != "routine-change":
                    check(not r.get("isRevised"),
                          f"{day['id']}/{state}: isRevised must not appear outside routine-change "
                          f"(rule '{r['action']}')")

    # Days 1-5 are monotone: the memory only ever grows. A rule or trigger that
    # disappears means a line was dropped in transcription.
    for prev_id, cur_id in zip(DAY_IDS[:-2], DAY_IDS[1:-1]):
        prev, cur = by_id[prev_id], by_id[cur_id]
        check(set(s["id"] for s in prev["states"]) <= set(s["id"] for s in cur["states"]),
              f"{cur_id}: lost a state that existed on {prev_id}")
        prev_trans = {transition_key(t) for t in prev["transitions"]}
        cur_trans = {transition_key(t) for t in cur["transitions"]}
        check(prev_trans <= cur_trans,
              f"{cur_id}: lost a transition that existed on {prev_id}: "
              f"{sorted(prev_trans - cur_trans)}")
        for state, prev_rules in prev["rules"].items():
            cur_rules = {rule_key(r): r for r in cur["rules"].get(state, [])}
            for pr in prev_rules:
                key = rule_key(pr)
                check(key in cur_rules, f"{cur_id}/{state}: lost rule '{key}' from {prev_id}")
                if key not in cur_rules:
                    continue
                prev_triggers = [t["text"] for t in pr["triggers"]]
                cur_triggers = [t["text"] for t in cur_rules[key]["triggers"]]
                check(cur_triggers[:len(prev_triggers)] == prev_triggers,
                      f"{cur_id}/{state}/'{key}': existing triggers changed or reordered")

    # isNew must mean "not present on the previous day".
    for prev_id, cur_id in zip(DAY_IDS[:-2], DAY_IDS[1:-1]):
        prev, cur = by_id[prev_id], by_id[cur_id]
        prev_states = {s["id"] for s in prev["states"]}
        prev_trans = {transition_key(t) for t in prev["transitions"]}
        for s in cur["states"]:
            check(s["isNew"] == (s["id"] not in prev_states),
                  f"{cur_id}: state {s['id']} isNew={s['isNew']} contradicts {prev_id}")
        for t in cur["transitions"]:
            key = transition_key(t)
            check(t["isNew"] == (key not in prev_trans),
                  f"{cur_id}: transition {key} isNew={t['isNew']} contradicts {prev_id}")
        for state, rules in cur["rules"].items():
            prev_keys = {rule_key(r) for r in prev["rules"].get(state, [])}
            prev_trigs = {rule_key(r): {t["text"] for t in r["triggers"]}
                          for r in prev["rules"].get(state, [])}
            for r in rules:
                key = rule_key(r)
                check(r["isNew"] == (key not in prev_keys),
                      f"{cur_id}/{state}: rule '{key}' isNew={r['isNew']} contradicts {prev_id}")
                for t in r["triggers"]:
                    was_there = t["text"] in prev_trigs.get(key, set())
                    check(t["isNew"] == (not was_there),
                          f"{cur_id}/{state}/'{key}': trigger '{t['text']}' "
                          f"isNew={t['isNew']} contradicts {prev_id}")

    # Day 1 is the memory's birth: everything on it is new.
    d1 = by_id["day1"]
    check(all(s["isNew"] for s in d1["states"]), "day1: every state must be isNew")
    check(all(t["isNew"] for t in d1["transitions"]), "day1: every transition must be isNew")

    # Day 5 introduces no new rules and no new states (paper, Appendix C.1).
    d5 = by_id["day5"]
    check(not any(s["isNew"] for s in d5["states"]), "day5: must introduce no new state")
    check(not any(r["isNew"] for rs in d5["rules"].values() for r in rs),
          "day5: must introduce no new rule")

    # The routine change is a rewrite, not an append.
    rc = by_id["routine-change"]
    revised = [(state, r) for state, rs in rc["rules"].items() for r in rs if r.get("isRevised")]
    check(len(revised) == 1, "routine-change: expected exactly one revised rule")
    for state, r in revised:
        check("wasAction" in r, "routine-change: a revised rule must carry wasAction")
        if "wasAction" in r:
            d5_actions = {rr["action"] for rr in d5["rules"].get(state, [])}
            check(r["wasAction"] in d5_actions,
                  f"routine-change/{state}: wasAction '{r['wasAction']}' does not match "
                  f"any of day5's actions for state '{state}' {sorted(d5_actions)}")

    if errors:
        for e in errors:
            print(f"FAIL  {e}")
        print(f"\n{len(errors)} problem(s)")
        return 1
    print(f"OK  {len(days)} days, all invariants hold")
    return 0


if __name__ == "__main__":
    sys.exit(main())
