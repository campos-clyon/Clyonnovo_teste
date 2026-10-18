import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet } from "react-native";

/**
 * A BORDA QUE BRILHA NOS TRABALHOS POR ABRIR.
 *
 * «Os pedidos ainda não abertos devem ter bordas brilhantes para chamar a
 * atenção» — 18-10-2026. Uma borda na cor da CLYON que pulsa devagar por cima
 * do cartão. Quem tem «reduzir movimento» ligado no telemóvel vê-a acesa, sem
 * pulsar.
 *
 * Fica por cima do cartão e não recebe toques: o toque continua a abrir o
 * trabalho.
 */
export function BordaABrilhar({ cor, raio }: { cor: string; raio: number }) {
  const luz = useRef(new Animated.Value(1)).current;
  const [semMovimento, setSemMovimento] = useState(false);

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => vivo && setSemMovimento(v))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (semMovimento) {
      luz.setValue(1);
      return;
    }
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(luz, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(luz, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [luz, semMovimento]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: raio, borderWidth: 2, borderColor: cor, opacity: luz }]}
    />
  );
}
