import React from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';

// Nunito (la fuente de la maqueta). Cada grosor es un archivo; elegimos el correcto según fontWeight.
const FAM: Record<string, string> = {
  '100': 'Nunito_400Regular',
  '200': 'Nunito_400Regular',
  '300': 'Nunito_400Regular',
  '400': 'Nunito_400Regular',
  normal: 'Nunito_400Regular',
  '500': 'Nunito_600SemiBold',
  '600': 'Nunito_600SemiBold',
  '700': 'Nunito_700Bold',
  bold: 'Nunito_700Bold',
  '800': 'Nunito_800ExtraBold',
  '900': 'Nunito_900Black',
};

function withFont(style: TextProps['style'], fallback = '400') {
  const flat = (StyleSheet.flatten(style) || {}) as { fontWeight?: string | number; fontFamily?: string };
  if (flat.fontFamily) return style;
  const fam = FAM[String(flat.fontWeight ?? fallback)] || FAM['400'];
  return [style, { fontFamily: fam, fontWeight: 'normal' as const }];
}

export function Text(props: TextProps) {
  return <RNText {...props} style={withFont(props.style)} />;
}

export function TextInput(props: TextInputProps) {
  return <RNTextInput {...props} style={withFont(props.style, '600')} />;
}
