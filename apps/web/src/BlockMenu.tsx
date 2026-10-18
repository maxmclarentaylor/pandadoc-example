import { BLOCK_ACTIONS } from './pages/salesContract'

type BlockMenuProps = {
  onDelete: () => void
}

export default function BlockMenu({ onDelete }: BlockMenuProps) {
  return (
    <div className="block-menu" role="menu">
      <label className="block-menu-name">
        <span>Text name</span>
        <input defaultValue="Text" />
      </label>
      {BLOCK_ACTIONS.map((item) => (
        <button key={item.label} type="button" role="menuitem">
          <item.icon className="menu-icon" aria-hidden strokeWidth={1.75} />
          <span>{item.label}</span>
        </button>
      ))}
      <div className="chunk-picker-divider" />
      <button type="button" role="menuitem">
        <span>Copy</span>
        <span className="shortcut">⌘C</span>
      </button>
      <button type="button" role="menuitem">
        <span>Cut</span>
        <span className="shortcut">⌘X</span>
      </button>
      <button type="button" role="menuitem">
        Duplicate
      </button>
      <button type="button" className="block-menu-delete" role="menuitem" onClick={onDelete}>
        Delete
      </button>
    </div>
  )
}
