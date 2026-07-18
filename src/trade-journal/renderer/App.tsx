import { useState } from 'react'
import { Sidebar, type ViewKey } from './components/Sidebar'
import { RecordPage } from './features/record/RecordPage'
import { ViewerPage } from './features/viewer/ViewerPage'
import { TagsPage } from './features/tags/TagsPage'
import { RulesPage } from './features/rules/RulesPage'
import { SettingsPage } from './features/settings/SettingsPage'

export function App(): JSX.Element {
  const [view, setView] = useState<ViewKey>('record')

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar active={view} onChange={setView} />
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'record' && <RecordPage />}
        {view === 'viewer' && <ViewerPage />}
        {view === 'tags' && <TagsPage />}
        {view === 'rules' && <RulesPage />}
        {view === 'settings' && <SettingsPage />}
      </div>
    </div>
  )
}
