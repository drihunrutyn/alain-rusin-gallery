import { useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useRooms } from "../queries/gallery";
import type { Artwork } from "./gallery-ui";

export function RoomSimulator({ artwork, onRequest }: { artwork: Artwork; onRequest: () => void }) {
  const rooms = useRooms();
  const [scene, setScene] = useState("#333431");
  const [scale, setScale] = useState(100);
  const [position, setPosition] = useState({ x: 50, y: 37 });
  const wall = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const photo = scene.startsWith("https:");
  return (
    <section className="room-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Примерить в интерьер</span>
          <h2>
            Работа <em>в пространстве</em>
          </h2>
        </div>
        <button
          className="text-link"
          onClick={() => {
            setPosition({ x: 50, y: 37 });
            setScale(100);
          }}
        >
          Сбросить
        </button>
      </div>
      <div className="room-options">
        {[
          ["#333431", "Графитовая стена"],
          ["#c9b79c", "Тёплый беж"],
          ["#243650", "Глубокий синий"],
        ].map(([color, label]) => (
          <button
            className={scene === color ? "room-choice active" : "room-choice"}
            key={color}
            style={{ background: color }}
            onClick={() => setScene(color)}
            aria-label={label}
            title={label}
          />
        ))}
        {rooms.data?.map((r) => (
          <button
            className={scene === r.imageUrl ? "room-choice active" : "room-choice"}
            key={r.id}
            onClick={() => setScene(r.imageUrl)}
            aria-label="Загруженный интерьер"
          >
            <img src={r.imageUrl} alt="Интерьер" />
          </button>
        ))}
      </div>
      <div
        className={`room-wall ${photo ? "photo-room" : ""}`}
        style={{
          backgroundColor: photo ? "#333" : scene,
          backgroundImage: photo ? `url("${scene}")` : undefined,
        }}
        ref={wall}
      >
        {!photo && (
          <>
            <div className="room-floor" />
            <div className="room-console">
              <div className="console-top" />
              <div className="console-leg left" />
              <div className="console-leg right" />
              <div className="room-vase" />
            </div>
          </>
        )}
        <button
          className="room-artwork"
          style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${scale * 0.22}%` }}
          draggable={false}
          aria-label={`${artwork.title}. Перетащите или перемещайте клавишами со стрелками.`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, startX: position.x, startY: position.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current || !wall.current) return;
            const b = wall.current.getBoundingClientRect();
            setPosition({
              x: Math.max(
                15,
                Math.min(85, drag.current.startX + ((e.clientX - drag.current.x) / b.width) * 100),
              ),
              y: Math.max(
                15,
                Math.min(70, drag.current.startY + ((e.clientY - drag.current.y) / b.height) * 100),
              ),
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
              e.preventDefault();
              setPosition((p) => ({
                x: Math.max(
                  15,
                  Math.min(85, p.x + (e.key === "ArrowLeft" ? -2 : e.key === "ArrowRight" ? 2 : 0)),
                ),
                y: Math.max(
                  15,
                  Math.min(70, p.y + (e.key === "ArrowUp" ? -2 : e.key === "ArrowDown" ? 2 : 0)),
                ),
              }));
            }
          }}
        >
          <img src={artwork.imageUrl} alt={artwork.title} draggable={false} />
        </button>
      </div>
      <div className="room-controls">
        <label htmlFor="art-scale">
          Масштаб <span>{scale}%</span>
          <input
            aria-label="Масштаб"
            id="art-scale"
            type="range"
            min={30}
            max={150}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          />
        </label>
        <button className="button" onClick={onRequest}>
          Запросить работу
          <ArrowUpRight size={16} />
        </button>
      </div>
      <p className="muted small">
        Перетащите картину мышью или касанием. Примерка иллюстративна и не определяет физический
        размер работы.
      </p>
    </section>
  );
}
