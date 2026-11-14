/** PIC D character art catalogue. Stable name -> role/gender/palette, not inferred from skin or appearance. */
export type GenderDesign = 'female' | 'male';
export type HairStyle = 'short' | 'spiky' | 'bob' | 'long' | 'ponytail';
export type CharacterLook = {
  shirt: number; trim: number; shoe: number; skin: number; hair: number;
  accent: number; accentSide: -1|1; longHair: boolean; hat: boolean;
  gender: GenderDesign | 'player'; hairStyle: HairStyle; glasses: boolean; tunic: boolean;
};
/** Explicit decisions approved by PIC D: these names remain identical across rooms and reloads. */
export const NPC_GENDER: Readonly<Record<string, GenderDesign>> = Object.freeze({
  'Bu Rani':'female', 'Adit':'male', 'Bu Dita':'female', 'Bu Maya':'female',
  'Pak Arif':'male', 'Bu Sinta':'female', 'Kak Nara':'female', 'Bu Nisa':'female',
  'Pak Damar':'male', 'Bu Sari':'female', 'Pak Bima':'male', 'Bu Lestari':'female',
  'Bu Ratna':'female', 'Mas Bayu':'male', 'Kak Wulan':'female',
});
const CAST: Readonly<Record<string, {
  hairStyle: HairStyle; hair: number; skin: number; shirt: number;
  trim: number; accent: number; hat?: boolean; glasses?: boolean; tunic?: boolean;
}>> = Object.freeze({
  'Bu Rani':     { hairStyle:'bob',      hair:0x45382f, skin:0xe2b18b, shirt:0x987456, trim:0xe6ce99, accent:0x6b937e, glasses:true },
  'Adit':        { hairStyle:'spiky',    hair:0x343339, skin:0xdeb38e, shirt:0xd5e0de, trim:0x4f768e, accent:0x42608e },
  'Bu Dita':     { hairStyle:'ponytail', hair:0x674c3d, skin:0xf0bb91, shirt:0x885f86, trim:0xdcc0d8, accent:0xe3b17b, tunic:true },
  'Bu Maya':     { hairStyle:'long',     hair:0x453c43, skin:0xdba67d, shirt:0x517d88, trim:0xd5c48d, accent:0xf2d49a, glasses:true },
  'Pak Arif':    { hairStyle:'short',    hair:0x5c5144, skin:0xc88e69, shirt:0x566778, trim:0xc0d0d8, accent:0xcdb184 },
  'Bu Sinta':    { hairStyle:'bob',      hair:0x342a3b, skin:0xf0c8a2, shirt:0xc9d6cf, trim:0x528fa0, accent:0x79a2b0, glasses:true },
  'Kak Nara':    { hairStyle:'ponytail',    hair:0x7c4a71, skin:0xe2b993, shirt:0x6a91a1, trim:0xe2cee4, accent:0xcaa1db },
  'Bu Nisa':     { hairStyle:'long',     hair:0x453a31, skin:0xae7758, shirt:0xa15c64, trim:0xf0d8ba, accent:0xe9b36b, tunic:true },
  'Pak Damar':   { hairStyle:'short',    hair:0x293743, skin:0xc6916d, shirt:0x4d8170, trim:0xc7dbbf, accent:0xdbb26c },
  'Bu Sari':     { hairStyle:'ponytail', hair:0x5c333a, skin:0xeab78c, shirt:0xd18459, trim:0xf2d6a4, accent:0xe2a64b, tunic:true },
  'Pak Bima':    { hairStyle:'spiky',    hair:0x3a3543, skin:0xa97454, shirt:0x455f82, trim:0xd3b78a, accent:0xe0c86e },
  'Bu Lestari':  { hairStyle:'long',     hair:0x634d35, skin:0xeac19d, shirt:0x607f69, trim:0xe6d7a7, accent:0x9caecd, glasses:true },
  'Bu Ratna':    { hairStyle:'bob',      hair:0x4b334b, skin:0xcf996c, shirt:0x9a748c, trim:0xd4c6e2, accent:0xadc5d2, tunic:true },
  'Mas Bayu':    { hairStyle:'spiky',    hair:0x262c39, skin:0xbd8d65, shirt:0x657d91, trim:0xe1c069, accent:0xc9a957, hat:true },
  'Kak Wulan':   { hairStyle:'ponytail', hair:0x493b30, skin:0xe9b895, shirt:0x638952, trim:0xe3d9af, accent:0xf0bf82, tunic:true },
});
export function hashIdentity(text: string): number {
  let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
/** Unknown identities remain deterministic; no hidden random assignment. */
export function characterLook(id:string, name:string, role:string, baseColor:number):CharacterLook {
  const predefined=CAST[name];
  const h=hashIdentity(id+'|'+name+'|'+role);
  const shirtColors=[0x5b8a85,0xb76453,0x4b7595,0x8a749e,0x67905b,0xc19a53,0x9c636c,0x476779];
  const hairColors=[0x302a31,0x604038,0x8f533d,0x263d4b,0xc68e43,0x684d74];
  const skinColors=[0xf5cba2,0xdfb18c,0xc58c65,0xf0b78d,0xa97555,0xe1c39c];
  const fallbackStyle:HairStyle = ['short','bob','spiky','long','ponytail'][h%5] as HairStyle;
  const hairStyle=predefined?.hairStyle??fallbackStyle;
  const gender:GenderDesign|'player' = NPC_GENDER[name]??'player';
  return {
    gender,hairStyle,longHair:['long','bob','ponytail'].includes(hairStyle),
    shirt:predefined?.shirt??(id==='pemain'?baseColor:shirtColors[(h>>>5)%shirtColors.length]),
    trim:predefined?.trim??0xd7c28d, shoe:0x263342,
    skin:predefined?.skin??skinColors[(h>>>2)%skinColors.length],
    hair:predefined?.hair??hairColors[(h>>>8)%hairColors.length],
    accent:predefined?.accent??0xd6bd70, accentSide:(h&1)?1:-1,
    hat:predefined?.hat??false, glasses:predefined?.glasses??false,
    tunic:predefined?.tunic??false,
  };
}
