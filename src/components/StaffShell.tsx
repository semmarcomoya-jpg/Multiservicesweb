/**
 * Vista del personal como en la maqueta: en computadora, el celular del cliente a la
 * izquierda (la app real, en vivo) y el panel interno a la derecha, con el selector
 * Cliente · Tienda · Admin arriba. En el celular solo se ve el panel.
 */
import { router } from 'expo-router';
import React, { createContext, useContext } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';

import { ViewSwitch } from '@/components/panel';
import { Text } from '@/components/Text';
import { LangToggle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';

const ShellCtx = createContext(false);
/** true cuando el panel ya está dentro del marco de escritorio (el encabezado lo pone el marco). */
export const useInShell = () => useContext(ShellCtx);

function clientUrl() {
  if (typeof window === 'undefined') return '/inicio';
  const p = window.location.pathname;
  const cut = Math.max(p.indexOf('/admin'), p.indexOf('/tienda'));
  const base = cut > 0 ? p.slice(0, cut) : '';
  return `${window.location.origin}${base}/inicio`;
}

export function StaffShell({ kind, children }: { kind: 'tienda' | 'admin'; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const { L } = useLang();
  const { signOut } = useAuth();
  const wide = Platform.OS === 'web' && width >= 1100;
  if (!wide) return <ShellCtx.Provider value={false}>{children}</ShellCtx.Provider>;

  return (
    <ShellCtx.Provider value={true}>
      <View style={{ flex: 1, backgroundColor: C.page }}>
        {/* Encabezado como la maqueta */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.goldSoft, fontWeight: '900', fontSize: 21 }}>C</Text>
            </View>
            <View>
              <Text style={{ fontWeight: '900', fontSize: 18, color: C.ink }}>Castillo Multiservices</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.muted }}>{L('Cliente, tienda y administrador', 'Customer, store and admin')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ViewSwitch current={kind} />
            <LangToggle />
            <Pressable accessibilityRole="button" onPress={async () => { await signOut(); router.replace('/bienvenida'); }}
              style={{ paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderRadius: 14, borderWidth: 2, borderColor: C.line, backgroundColor: C.card }}>
              <Text style={{ fontWeight: '800', color: C.ink }}>{L('Salir', 'Sign out')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 1, flexDirection: 'row', gap: 24, paddingHorizontal: 24, paddingBottom: 16 }}>
          {/* Celular del cliente: la app real en vivo */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1, color: C.muted }}>{L('CLIENTE · WEB APP', 'CUSTOMER · WEB APP')}</Text>
            <View style={{ width: 390, height: 844, maxHeight: '100%', borderRadius: 34, overflow: 'hidden', borderWidth: 1, borderColor: C.line2, backgroundColor: C.cream, shadowColor: '#7A3412', shadowOpacity: 0.18, shadowRadius: 60, shadowOffset: { width: 0, height: 24 } }}>
              {React.createElement('iframe', { src: clientUrl(), title: L('Vista del cliente', 'Customer view'), style: { border: 0, width: '100%', height: '100%' } })}
            </View>
          </View>
          {/* Panel interno */}
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1, color: C.muted }}>{L('PANEL INTERNO', 'INTERNAL PANEL')}</Text>
            <View style={{ flex: 1, borderRadius: 18, overflow: 'hidden' }}>{children}</View>
          </View>
        </View>
      </View>
    </ShellCtx.Provider>
  );
}

export const ShellRadius = R.lg;
