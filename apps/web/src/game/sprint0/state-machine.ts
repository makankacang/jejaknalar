export type GameState='IDLE'|'LOADING'|'READY'|'EXPLORING'|'INTERACTING'|'CHALLENGE'|'ASSESSMENT'|'SUBMITTING'|'FEEDBACK'|'ADAPTIVE_TRANSITION'|'COMPLETED'|'ERROR';
export type GameEvent='LOAD'|'LOADED'|'PLAY'|'INTERACT'|'CLOSE_INTERACTION'|'CHALLENGE_START'|'ASSESSMENT_START'|'SUBMIT'|'SCORED'|'NEXT_PATH'|'COMPLETE'|'RETRY'|'FAIL'|'RECOVER';
export class InvalidTransitionError extends Error { constructor(s:GameState,e:GameEvent){super(`Transisi tidak sah: ${s} + ${e}`);this.name='InvalidTransitionError';} }
const allowed: Partial<Record<GameState,Partial<Record<GameEvent,GameState>>>>={
  IDLE:{LOAD:'LOADING'},LOADING:{LOADED:'READY',FAIL:'ERROR'},
  READY:{PLAY:'EXPLORING',FAIL:'ERROR'},
  EXPLORING:{INTERACT:'INTERACTING',CHALLENGE_START:'CHALLENGE',FAIL:'ERROR'},
  INTERACTING:{CLOSE_INTERACTION:'EXPLORING',FAIL:'ERROR'},
  CHALLENGE:{ASSESSMENT_START:'ASSESSMENT',RETRY:'EXPLORING',FAIL:'ERROR'},
  ASSESSMENT:{SUBMIT:'SUBMITTING',FAIL:'ERROR'},
  SUBMITTING:{SCORED:'FEEDBACK',FAIL:'ERROR'},
  FEEDBACK:{NEXT_PATH:'ADAPTIVE_TRANSITION',RETRY:'CHALLENGE'},
  ADAPTIVE_TRANSITION:{COMPLETE:'COMPLETED',RETRY:'EXPLORING'},
  COMPLETED:{RETRY:'EXPLORING'},ERROR:{RECOVER:'LOADING'}
};
export function transitionGameState(current:GameState,event:GameEvent):GameState {
 const next=allowed[current]?.[event]; if(!next)throw new InvalidTransitionError(current,event);return next;
}
