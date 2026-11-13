/** BACKEND ONLY: this file contains private rubric logic; NEVER import into React/Phaser. */
export interface PrivateItem {itemId:string;expected:string;maxPoints:number;}
export interface SubmittedAnswer {itemId:string;answer:string;}
export interface PrivateScore {earned:number;possible:number;byItem:Array<{itemId:string;earned:number}>;}
const normalize=(v:string)=>v.trim().toLocaleLowerCase('id-ID').replace(/\s+/g,' ');
/** Prototype deterministic scorer for exact-match test items; use verified backend authorization. */
export function scoreExactMatch(items:PrivateItem[],responses:SubmittedAnswer[]):PrivateScore{
 const ids=new Set<string>();let earned=0;let possible=0;const byItem=[];
 for(const item of items){
  if(ids.has(item.itemId)||item.maxPoints<0||!Number.isFinite(item.maxPoints))throw new Error('Invalid private rubric');
  ids.add(item.itemId);possible+=item.maxPoints;
  const ans=responses.find(x=>x.itemId===item.itemId);
  const points=ans&&normalize(ans.answer)===normalize(item.expected)?item.maxPoints:0;
  earned+=points;byItem.push({itemId:item.itemId,earned:points});
 }
 return {earned,possible,byItem};
}
