import { describe, expect, it } from 'vitest';
import { adaptStoryBundle, StoryContractError } from './adapter';
import { REGISTRY_VERSION, ROOMS } from '../world';
const room = Object.values(ROOMS).find(r=>r.world==='school' && r.targets.some(t=>t.kind==='task'))!;
const target = room.targets.find(t=>t.kind==='task')!;
const ref = {document_id:'doc1',text_version:'v1',source_map_id:'s1',excerpt:'Example excerpt',locator:{kind:'pdf_page',page:1}};
const quest = {schema_version:'1.0' as const,quest_version_id:'QV-TEST-1',objective_ids:['LO-TEST-1'],scene_id:'explicit-scene'};
const bundle = () => ({bundle_schema_version:'0.1-draft',quest_version_id:quest.quest_version_id,source_document_versions:[{document_id:'doc1',text_version:'v1'}],registry_version:REGISTRY_VERSION,world_preset:'school',start_room_id:room.id,title:'Demo',opening:'Cerita pembuka',missions:[{mission_id:'m1',objective_ids:['LO-TEST-1'],required:true,room_id:room.id,prerequisites:[],activity_ids:['a1']}],tasks:[{activity_id:'a1',room_id:room.id,object_id:target.objectId!,template:'observe',objective_ids:['LO-TEST-1'],instruction:'Periksa catatan',source_refs:[ref]}],dialogues:[],evidence:[],endings:{developing:'Selesai'}});
const adapt = (b: unknown) => adaptStoryBundle(b,quest,{allowedSceneIds:['explicit-scene']});
describe('D-05 C-03 draft adapter',()=>{
 it('builds a preview-only plan with opening and objectives',()=>{const p=adapt(bundle());expect(p.previewOnly).toBe(true);expect(p.prologue).toBe('Cerita pembuka');expect(p.objectives).toHaveLength(1);});
 it('rejects unpinned C-03 registry',()=>expect(()=>adapt({...bundle(),registry_version:'0.2.0-draft'})).toThrow(StoryContractError));
 it('rejects quest version mismatch',()=>expect(()=>adapt({...bundle(),quest_version_id:'QV-OTHER'})).toThrow());
 it('rejects unknown object ID',()=>{const b=bundle();b.tasks[0].object_id='invented-object';expect(()=>adapt(b)).toThrow();});
 it('rejects invented assessment item mapping',()=>{const b={...bundle(),tasks:[{...bundle().tasks[0],public_item_ids:['ITEM-FAKE']}]};expect(()=>adapt(b)).toThrow();});
 it('rejects missing source snapshot reference',()=>{const b=bundle();b.tasks[0].source_refs=[{...ref,document_id:'unknown'}];expect(()=>adapt(b)).toThrow();});
 it('rejects unapproved scene',()=>expect(()=>adaptStoryBundle(bundle(),quest,{allowedSceneIds:[]})).toThrow());
});
