export default function Editor({ value, onChange }) {
  return (
    <div className="editor-wrapper">
      <textarea
        className="editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        placeholder="classDiagram을 입력하세요..."
      />
    </div>
  );
}
