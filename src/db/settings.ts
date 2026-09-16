import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './index'

export type ChineseDisplay = 'always' | 'tap' | 'never'

const CHINESE_DISPLAY_KEY = 'chinese_display'
const DEFAULT_CHINESE_DISPLAY: ChineseDisplay = 'tap'

// English first is the whole point of the app, so Chinese waits behind a tap unless the
// learner asks otherwise. Lives in `settings`, which is local to this device and not
// synced — a display preference, not learning data.
export async function getChineseDisplay(): Promise<ChineseDisplay> {
  const row = await db.settings.get(CHINESE_DISPLAY_KEY)
  return row?.value === 'always' || row?.value === 'never' ? row.value : DEFAULT_CHINESE_DISPLAY
}

export async function setChineseDisplay(value: ChineseDisplay): Promise<void> {
  await db.settings.put({ key: CHINESE_DISPLAY_KEY, value })
}

export function useChineseDisplay(): ChineseDisplay {
  return useLiveQuery(getChineseDisplay, [], DEFAULT_CHINESE_DISPLAY)
}
