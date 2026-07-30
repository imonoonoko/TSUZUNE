interface MoveDialogProps {
  notePath: string
  directories: string[]
  currentDirectory: string
  onCancel: () => void
  onConfirm: (directory: string) => void
}
export default function MoveDialog({
  notePath,
  directories,
  currentDirectory,
  onCancel,
  onConfirm
}: MoveDialogProps): React.JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="modal"
        aria-labelledby="move-dialog-title"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          onConfirm(String(data.get('directory') ?? ''))
        }}
      >
        <h2 id="move-dialog-title">ノートを移動</h2>
        <p>{notePath}</p>
        <label>
          移動先
          <select name="directory" defaultValue={currentDirectory} autoFocus>
            {directories.map((directory) => (
              <option value={directory} key={directory || '__root__'}>
                {directory || 'Vault直下'}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" className="primary-button">
            移動
          </button>
        </div>
      </form>
    </div>
  )
}
