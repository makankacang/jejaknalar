import { useEffect, useRef } from 'react';
import type { SceneActions } from '../../../game/sprint1/EvidenceHuntScene';

/** Phaser di-import saat komponen mount; tidak membebani landing page. */
export function PhaserStage(props: SceneActions) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  useEffect(() => {
    let disposed = false;
    let game: { destroy(removeCanvas?: boolean): void } | undefined;
    (async () => {
      const [{ default: Phaser }, { EvidenceHuntScene }] = await Promise.all([
        import('phaser'), import('../../../game/sprint1/EvidenceHuntScene')
      ]);
      if (disposed || !host.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: 800, height: 420,
        backgroundColor: '#f0ebd9',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [new EvidenceHuntScene({
          onNpc: () => callbacks.current.onNpc(),
          onDocument: () => callbacks.current.onDocument(),
          onChallenge: () => callbacks.current.onChallenge(),
        })],
      });
    })().catch(() => {
      if (!disposed && host.current) host.current.textContent = 'Game gagal dimuat. Pastikan dependency Phaser 3 terpasang.';
    });
    return () => { disposed = true; game?.destroy(true); game = undefined; };
  }, []);
  return <div ref={host} className="jn-game-canvas" aria-label="Peta perpustakaan JejakNalar" />;
}
