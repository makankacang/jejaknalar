import {ROOMS} from '../world';
import {CITY_LAYOUT_VERSION} from './world';
/** Proposal only, not PIC C content, not a production catalog, no generated API/schema. */
export const cityProposal=()=>{
 const object=ROOMS.city_market.targets.find(t=>t.task==='observe')!.objectId!;
 const refs=[{document_id:'CITY-SYNTH-DOC',text_version:'v1',source_map_id:'s1',excerpt:'Catatan kegiatan pasar adalah contoh lokal.',locator:{kind:'pdf_page' as const,page:1}}];
 return {fixture_only:true,quest:{schema_version:'1.0' as const,quest_version_id:'QV-FIXTURE-CITY-001',objective_ids:['LO-FIXTURE-CITY-001'],scene_id:'city_market'},story:{bundle_schema_version:'0.1-draft',quest_version_id:'QV-FIXTURE-CITY-001',source_document_versions:[{document_id:'CITY-SYNTH-DOC',text_version:'v1'}],registry_version:CITY_LAYOUT_VERSION,world_preset:'city',start_room_id:'city_market',title:'Jejak catatan pasar',opening:'Temui pedagang dan telusuri catatan sebelum menyimpulkan.',missions:[{mission_id:'CITY-M1',objective_ids:['LO-FIXTURE-CITY-001'],required:true,room_id:'city_market',prerequisites:[],activity_ids:['CITY-A1']}],dialogues:[],tasks:[{activity_id:'CITY-A1',room_id:'city_market',object_id:object,template:'observe',objective_ids:['LO-FIXTURE-CITY-001'],instruction:'Periksa catatan pasar',source_refs:refs}],evidence:[],endings:{developing:'Catatan terkumpul. Belum ada penilaian resmi.'}}};
};
