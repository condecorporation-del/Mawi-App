# Fase 3 - Detector de desviaciones financieras

La version de Fase 3 calcula desviaciones de forma deterministica con los datos disponibles:

- presupuesto del proyecto o partida en centavos;
- gasto real registrado en centavos;
- variacion absoluta en centavos;
- variacion porcentual en basis points.

Esta version no usa avance fisico. No existen aun `project_progress_snapshots` ni `progressPercent`, por lo que el detector no compara avance de obra contra consumo financiero.

## Pendiente tecnico para siguiente fase

- Incorporar `project_progress_snapshots`.
- Recalcular desviacion con presupuesto vs avance fisico vs gasto real.
- Ajustar explicaciones de riesgo para distinguir sobregasto real, avance rezagado y consumo anticipado de presupuesto.
