export function QuickReplies({ options, onPick, disabled }: { options: string[]; onPick: (o: string) => void; disabled?: boolean }) {
  if (!options.length) return null;
  return (
    <div className="quick-replies" role="group" aria-label="Quick replies">
      {options.map((o) => (
        <button key={o} type="button" className="chip" onClick={() => onPick(o)} disabled={disabled}>{o}</button>
      ))}
    </div>
  );
}
