# Portfolio cover science audit — 2026-10-16

Scope: all 22 illustrated covers from the preceding cover update, plus the concurrently added Earth heat-budget scene. The three game covers are actual gameplay images and were retained. Covers are introductions, not experiment instructions or quantitative data. Project categories, order, text and links are unchanged.

Twelve covers were replaced by deterministic, editable SVG diagrams and WebP renders. Source: `assets/covers/*-verified.svg`; builder: `scripts/build_verified_covers.py`. Rendering uses the installed Sharp library, 750 px width, WebP quality 88. Do not regenerate scientific arrows or apparatus connections through an unconstrained illustration prompt.

| Cover | Finding and final action |
|---|---|
| 대기 대순환 | Globe arrows conflated horizontal winds and vertical circulation. Replaced with a clearly labelled northern-hemisphere latitude–height section: rise at 0° and about 60°N; sink at about 30°N and 90°N; three cells with opposite surface/upper flow. This is an idealized zonal mean, not literal geographic wind tracks. |
| 엘니뇨와 라니냐 | One generic warm-west/cold-east picture did not distinguish the two states. Replaced with two equatorial Pacific SST-anomaly panels: central/eastern Pacific warmer than normal in El Niño, cooler in La Niña. Explicitly an anomaly schematic, not absolute SST. |
| 산화·환원 가상 실험실 | Copper electrode appeared in blue solution but the opposite gray electrode appeared in orange solution. Corrected to copper/blue CuSO4 and zinc/colorless ZnSO4; salt bridge contacts both solutions and voltmeter connects to both electrodes. |
| 배터리 가상 시험동 | Dry battery, loose metal strips and disconnected wires falsely implied an operative experiment. Replaced with an exploded paper-cell schematic: separated electrodes, electrolyte-wetted paper, meter across the electrodes. Expanded spacing is explicitly stated. |
| 배터리 시험팀 | Three dry, isolated electrode strips did not constitute a complete cell. Replaced with the same valid paper-cell principle, without inventing specific electrode identities or measured voltages. |
| 산·염기 가상 실험실 | Burette lacked a recognizable stopcock. Replaced with a graduated burette, clamp, stopcock, tip and receiving flask. Pale pink is illustrative indicator color, not a specified exact endpoint. |
| 반응 속도 가상 실험실 | A greater-than sign and differing bubble counts lacked a defined quantity or observation time. Replaced with a qualitative gas-volume/time comparison with equal final volume; no measured numbers or unprovided experimental conditions. |
| 열화학 가상 실험실 | Outward arrows around an insulated cup suggested heat loss as the measurement principle. Removed them. Show insulated cup, lid, thermometer and stirrer; explain inference from solution temperature change. |
| 산·염기 중화 반응 | Red + blue yielding purple could imply that acids/bases have inherent colors or neutralization is color mixing. Replaced with colorless HCl and NaOH examples, mixed solution and net ionic equation H+ + OH− → H2O. This equation is for the specified strong acid/base example. |
| 마이크로비트 처음 시작하기 | Decorative LED layout did not match the hardware. Replaced with a simplified V1 front schematic: 5×5 LEDs, two buttons, five large pin rings, USB connection. |
| 마이크로비트 센서 기록기 | Decorative board and direct probe/tablet wiring could imply an unsupported electrical connection. Corrected board layout and used a conceptual wireless transfer to a graph, without claiming an actual sensor circuit. |
| 첫 실험 교실 | Retained. Generic apparatus still life, not a connected experimental circuit or numerical measurement. |
| 기체 가상 실험실 | Retained. Gas syringe and pressure gauge have a closed tubing connection; particle inset is a model rather than measured data. |
| 화학 평형 가상 실험실 | Retained. Opposing arrows and alternative solution colors introduce reversible change; no claims about specific unlabelled reagents, temperatures or equilibrium constants. |
| 몰 농도 | Retained. Equal-volume beakers contain different particle-dot densities; dots are a conceptual model. No invented concentration values or solution-preparation directions. |
| 환경 대응팀 | Retained. Generic field samples and test strips, without specified pH values or a claimed result. |
| 영상 운동 분석기 | Retained. Conceptual trajectory and repeated positions, not calibrated motion data. |
| 수학책 편집 노트 | Retained. Generic geometry and page layout; no imported exam problem or asserted theorem. |
| AR 포토 | Retained. Depicts the tool's general framing function; not claimed to be an actual screenshot. |
| AR 전시관 | Retained. Depicts virtual display framing; not a measured spatial model or actual screenshot. |
| 적도의 정렬 매트와 별자리판 | Retained as a decorative introduction. Its tiny star marks are not a usable calibrated chart and are not labelled as a specific constellation. The cover is not an alignment guide. |
| 나의 면접 연습노트 | Retained. Notebook, speech bubble and timer, no scientific assertion. |

| 지구의 열수지 (concurrently added) | Preserved the new project. Its original illustrated simplified energy budget closes: incoming 100 = reflected 25 + 5 + outgoing 4 + 66; surface incoming 45 + 88 = outgoing 104 + 8 + 21; atmosphere incoming 25 + 100 + 8 + 21 = outgoing 66 + 88. At the user’s subsequent request, replaced only its cover with a matching paper/navy whole-Earth-system diagram: incoming solar 100, reflected solar 30 (=25+5), thermal radiation to space 70 (=66+4). These are normalized schematic fluxes at the top of the atmosphere, not a new data set. |

## Reference checks

- NOAA, Global Atmospheric Circulations: https://www.noaa.gov/jetstream/global/global-atmospheric-circulations
- NOAA, El Niño and La Niña: https://www.noaa.gov/education/resource-collections/weather-atmosphere/el-nino
- NOAA, ENSO: https://www.noaa.gov/jetstream/tropical/enso
- OpenStax Chemistry 2e, 17.2 Galvanic Cells: https://openstax.org/books/chemistry-2e/pages/17-2-galvanic-cells
- OpenStax Chemistry 2e, 5.2 Calorimetry: https://openstax.org/books/chemistry-2e/pages/5-2-calorimetry
- Micro:bit Educational Foundation, Features overview: https://microbit.org/get-started/features/overview/

These references were checked for the underlying scientific/hardware principles. Artwork and coordinates are original schematics, not copied reference illustrations.

## Browser translation protection

The user supplied two screenshots showing Chrome translation changing existing Korean text (for example 대기 대순환 → 대책 대순환, 고등학교 → 대학생). All four portfolio HTML entry points retain lang=ko and now declare translate=no, class=notranslate and Google’s notranslate meta tag. Descendants and dynamically inserted content inherit the document-level translation exclusion. This protects original scientific terminology and author/student text without changing stored content. Browser translation itself was not exercised in this runtime; source and deployed markup are checked.

Primary implementation reference: https://www.chromium.org/developers/design-documents/translate/

## Illustration-led update, 2026-10-16

The user preferred the earlier hand-printed editorial artwork over text-heavy diagrams. The twelve active corrected diagram covers are now replaced by nine subject illustrations, shared where a physical setup serves two related resources. Active artwork: assets/uploads/cover-art-*.webp. Title is rendered separately in HTML using item.title; the image itself contains no explanatory text, equations, numeric data or flow arrows. Browser translation exclusion is preserved. The older SVGs remain archived for scientific reference, not as active portfolio covers.

Generation used the built-in image tool with the existing interview-note cover as a style-only reference: warm ivory paper, navy pencil contours, flat ink fills, subtle screen-print texture; illustration below a blank title area. Subjects are atmospheric Earth/clouds, ocean-observing buoy, Sun/Earth, Cu/Zn galvanic cell, paper battery, titration apparatus, cup calorimeter, gas-evolution apparatus, and microcontroller board/laptop. No geographic temperature maps, global circulation vectors, measurements or pedagogical claims are encoded into the covers. Cell solution colors and physical connections, burette stopcock, insulated cup lid and gas syringe connections were visually checked.

## Exact visual reference correction

The user identified the unchanged 화학 평형 가상 실험실 cover as the visual reference: irregular chunky navy hand lettering and simple watercolor pigment areas. Earlier CSS serif headings and finely hatched illustrations did not match. Twelve covers now use full watercolor illustrations with integrated hand lettering, assets/uploads/cover-watercolor-*.webp. The original equilibrium cover was the direct style reference for each built-in generation call. Typography is no longer overlaid in HTML. No extra small explanatory captions, formulas or numerical data appear. The original equilibrium artwork, all other project data and browser translation protection remain unchanged.

## Two narrowly scoped cover repairs

Restored the waterproof external DS18B20 probe in the sensor-recorder cover: metal tip in water, sealed cable entry above water, dry sensor module linked to the board, wireless recording display. The actual sensor/temp.html preparation instructions were checked: 3V power, GND ground, data on P1, with a 4.7 kΩ pull-up (usually included on an adapter); the cover depicts a module rather than a pin-level wiring guide. Changed only the acid/base burette contents and falling drop to colorless; the receiving indicator flask remains pale pink. Both covers retain approved watercolor texture and lettering. All other covers and project fields are unchanged.
