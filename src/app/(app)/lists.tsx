import { Building, Check, Pencil, Plus, Shapes, Trash2, X } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { Button, Card, Empty, ErrorBox, Input, Loading, PressScale, Row, Screen, Segmented, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { fetchAll, useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { Category, Company } from '@/lib/types'

type Kind = 'categories' | 'companies'

/** Categories and companies of the organization */
export default function Lists() {
  const { t } = useI18n()
  const [kind, setKind] = useState<Kind>('categories')
  return (
    <Screen back title={t('lists')}>
      <Segmented value={kind} onChange={setKind} items={[{ value: 'categories', label: t('categories') }, { value: 'companies', label: t('companies') }]} />
      <ListEditor key={kind} kind={kind} />
    </Screen>
  )
}

function ListEditor({ kind }: { kind: Kind }) {
  const { t, pick } = useI18n()
  const { c } = useTheme()
  const { org, isAdmin, refresh } = useOrg()
  const { toast, confirm } = useFeedback()
  const [name, setName] = useState('')
  const [nameUr, setNameUr] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string; name_ur: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const { data, error, loading, reload } = useLoad(
    () => fetchAll<Category & Company>((a, b) => supabase.from(kind).select('*').eq('org_id', org.id).order('name').range(a, b)),
    [org.id, kind],
  )

  const add = async () => {
    if (!name.trim()) return
    setBusy(true)
    const { error } = kind === 'categories'
      ? await supabase.from('categories').insert({ org_id: org.id, name: name.trim(), name_ur: nameUr.trim() || null })
      : await supabase.from('companies').insert({ org_id: org.id, name: name.trim() })
    setBusy(false)
    if (error) return toast(errText(error, t), 'err')
    setName('')
    setNameUr('')
    toast(t('saved'))
    reload()
    refresh()
  }
  const saveEdit = async () => {
    if (!editing || !editing.name.trim()) return
    const patch = kind === 'categories' ? { name: editing.name.trim(), name_ur: editing.name_ur.trim() || null } : { name: editing.name.trim() }
    const { error } = await supabase.from(kind).update(patch).eq('id', editing.id)
    if (error) return toast(errText(error, t), 'err')
    setEditing(null)
    reload()
    refresh()
  }
  const remove = async (id: string) => {
    if (!(await confirm(`${t('delete')}?`))) return
    const { error } = await supabase.from(kind).delete().eq('id', id)
    if (error) return toast(errText(error, t), 'err')
    reload()
    refresh()
  }

  return (
    <View style={{ marginTop: 14, gap: 12 }}>
      <Card style={{ gap: 10 }}>
        <Input value={name} onChangeText={setName} placeholder={kind === 'categories' ? t('addCategory') : t('addCompany')} icon={kind === 'categories' ? <Shapes size={18} color={c.muted} /> : <Building size={18} color={c.muted} />} />
        {kind === 'categories' && <Input value={nameUr} onChangeText={setNameUr} placeholder={t('urduName')} textAlign="right" />}
        <Button title={t('add')} icon={<Plus size={18} color={c.primaryText} />} onPress={add} loading={busy} disabled={!name.trim()} />
      </Card>
      {loading && !data ? <Loading rows={4} /> : error ? <ErrorBox error={error} onRetry={reload} /> : !data?.length ? <Empty>{t('noData')}</Empty> : (
        <Card padded={false} style={{ paddingHorizontal: 14 }}>
          {data.map((x, i) => (
            <View key={x.id} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              {editing?.id === x.id ? (
                <View style={{ gap: 8 }}>
                  <Input value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} autoFocus />
                  {kind === 'categories' && <Input value={editing.name_ur} onChangeText={(v) => setEditing({ ...editing, name_ur: v })} placeholder={t('urduName')} textAlign="right" />}
                  <Row gap={8}>
                    <Button size="sm" title={t('save')} icon={<Check size={15} color={c.primaryText} />} onPress={saveEdit} style={{ flex: 1 }} />
                    <Button size="sm" variant="secondary" title={t('cancel')} icon={<X size={15} color={c.text} />} onPress={() => setEditing(null)} style={{ flex: 1 }} />
                  </Row>
                </View>
              ) : (
                <Row gap={10}>
                  <Txt weight="semibold" style={{ flex: 1 }}>{pick(x.name, (x as Category).name_ur)}</Txt>
                  <PressScale onPress={() => setEditing({ id: x.id, name: x.name, name_ur: (x as Category).name_ur ?? '' })} style={{ padding: 8 }}>
                    <Pencil size={16} color={c.textSoft} />
                  </PressScale>
                  {isAdmin && (
                    <PressScale onPress={() => remove(x.id)} style={{ padding: 8 }}>
                      <Trash2 size={16} color={c.red} />
                    </PressScale>
                  )}
                </Row>
              )}
            </View>
          ))}
        </Card>
      )}
    </View>
  )
}
