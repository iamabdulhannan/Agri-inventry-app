import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState as RNAppState } from 'react-native'
import { todayIn } from './format'
import { prefs } from './prefs'
import { supabase } from './supabase'
import type { Membership, Organization, Profile, Role } from './types'

interface AppState {
  ready: boolean
  session: Session | null
  profile: Profile | null
  memberships: Membership[]
  org: Organization | null
  role: Role | null
  isAdmin: boolean
  today: string
  /** bumps whenever stock / money changes so every screen reloads */
  version: number
  /** set when the owner removed this account */
  removed: boolean
  refresh: () => void
  switchOrg: (id: string) => void
  reloadOrgs: () => Promise<void>
  setProfile: (p: Profile) => void
  signOut: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)
const ORG_KEY = 'agri.org'

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  /** user id the memberships were last loaded for ('' = signed out) */
  const [orgsFor, setOrgsFor] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [orgId, setOrgId] = useState<string | null>(() => prefs.get(ORG_KEY))
  const [version, setVersion] = useState(0)
  const [removed, setRemoved] = useState(false)
  const [tick, setTick] = useState(0) // re-evaluates "today" when the app comes back

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  // A member removed by the owner is deleted on the server: when the app comes
  // back to the foreground (and every minute) check, and sign out locally if gone.
  useEffect(() => {
    if (!userId) return
    let stopped = false
    const check = async () => {
      if (stopped || RNAppState.currentState !== 'active') return
      const { error } = await supabase.auth.getUser()
      if (!error) return
      const gone = error.status === 401 || error.status === 403 || error.status === 404 || /not.?found|does not exist/i.test(error.message)
      if (gone && !stopped) {
        setRemoved(true)
        await supabase.auth.signOut({ scope: 'local' })
      }
    }
    const id = setInterval(check, 60_000)
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setTick((x) => x + 1)
        check()
      }
    })
    return () => {
      stopped = true
      clearInterval(id)
      sub.remove()
    }
  }, [userId])

  const reloadOrgs = useCallback(async () => {
    if (!userId) {
      setMemberships([])
      setProfile(null)
      setOrgsFor('')
      return
    }
    const [m, p] = await Promise.all([
      supabase.from('memberships').select('role, organizations(*)').eq('user_id', userId).order('created_at'),
      supabase.from('profiles').select('id, full_name, email').eq('id', userId).maybeSingle(),
    ])
    setMemberships(((m.data ?? []) as unknown as Membership[]).filter((x) => x.organizations))
    setProfile((p.data as Profile) ?? null)
    setOrgsFor(userId)
  }, [userId])

  useEffect(() => {
    reloadOrgs()
  }, [reloadOrgs])

  const current = memberships.find((m) => m.organizations.id === orgId) ?? memberships[0] ?? null

  const switchOrg = useCallback((id: string) => {
    setOrgId(id)
    prefs.set(ORG_KEY, id)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setMemberships([])
    setProfile(null)
  }, [])

  const org = current?.organizations ?? null
  const value = useMemo<AppState>(
    () => ({
      ready: authReady && (!session || orgsFor === session.user.id),
      session,
      profile,
      memberships,
      org,
      role: current?.role ?? null,
      isAdmin: current?.role === 'owner' || current?.role === 'admin',
      today: todayIn(org?.timezone),
      version,
      removed,
      refresh: () => setVersion((v) => v + 1),
      switchOrg,
      reloadOrgs,
      setProfile,
      signOut,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authReady, orgsFor, session, profile, memberships, org, current, version, removed, switchOrg, reloadOrgs, signOut, tick],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}

/** For screens inside the app shell where an organization is guaranteed */
export function useOrg() {
  const a = useApp()
  if (!a.org) throw new Error('No organization selected')
  return { ...a, org: a.org }
}
