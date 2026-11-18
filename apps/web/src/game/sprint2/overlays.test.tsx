import { describe,expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dialog,LocationBadge } from '../../features/student/sprint2/overlays';
import { ROOMS } from './world';
describe('actual overlay components',()=>{
 it('NPC dialogue has name/text/options only, no image/avatar and bottom-layout class',()=>{const html=renderToStaticMarkup(<Dialog dialogue title="Bu Rani" close={()=>{}}><p>Periksa catatan.</p><button>Lanjut</button></Dialog>);expect(html).toContain('Bu Rani');expect(html).toContain('Periksa catatan.');expect(html).toContain('vn-npc-dialogue');expect(html).not.toMatch(/<img|<canvas|avatar|portrait|<svg/);expect(html).toContain('aria-modal="true"');});
 for(const r of Object.values(ROOMS))it(`location label ${r.id}`,()=>{const html=renderToStaticMarkup(<LocationBadge room={r}/>);expect(html).toContain(r.title.replaceAll('&','&amp;'));expect(html).toContain(r.world==='school'?'SEKOLAH':'KOTA');});
});
