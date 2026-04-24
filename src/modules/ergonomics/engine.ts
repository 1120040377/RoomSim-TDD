import type { Plan, Vec2 } from '@/modules/model/types';

export type Severity = 'warn' | 'error';

export interface Warning {
  id: string;
  ruleId: string;
  severity: Severity;
  position: Vec2;
  message: string;
  relatedIds: string[];
}

export interface Rule {
  id: string;
  check(plan: Plan): Warning[];
}

export class ErgonomicsEngine {
  private rules: Rule[] = [];

  register(r: Rule) {
    this.rules.push(r);
  }

  run(plan: Plan): Warning[] {
    const out: Warning[] = [];
    for (const r of this.rules) {
      try {
        out.push(...r.check(plan));
      } catch (err) {
        console.error(`[ergonomics] rule ${r.id} failed`, err);
      }
    }
    return out;
  }
}
