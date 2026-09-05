# 光・観測・科学可視化の境界調査

観測日: 2026-09-05。LIGHT-OBSERVATION調査packetを統合した。公式NASA、ESA、STScI、ALMA/NRAO、Chandra資料20件を確認し、13件をcore sourceとした。

## 結論

実在宇宙を参考にすることは、公開写真の色と形を模倣することではない。観測画像は、望遠鏡と検出器が特定帯域で得たphoton count／intensityを較正し、位置合わせし、2Dへ投影し、表示可能なdynamic rangeへ圧縮し、色channelへ割り当てた表現である。不可視帯域に肉眼で見る固有色はない。

## 物理現象を分ける

- emission: 電離gasの輝線、熱dust、synchrotron、X線plasmaなど、物質自体が放つ。
- scattering/reflection: 周囲の星光がdustで散乱される。
- absorption/extinction: 手前のdust/gasが背景光を遮る。暗部は空虚とは限らない。
- spectral tracer: 特定原子・分子lineやcontinuumが異なる密度、温度、化学状態を選択的に示す。
- lensing/redshift: lensingは前景質量で背景像の位置・形・倍率が変わる現象。redshiftはspectrumの波長変位であり、公開画像を単に赤く塗ることではない。

## 波長ごとの役割

| 層 | 主に見えるもの | 誤読防止 |
|---|---|---|
| 可視 | 恒星continuum、電離gasの輝線、反射、dust extinction | narrow-band RGB割当は自然色とは限らない |
| NIR/MIR | 埋もれた原始星、warm dust、PAH、可視より透過しやすい構造 | IRは単純なheat mapではない |
| radio/mm | cold dust continuum、特定分子line、速度cube | 干渉計像はbaselineから再構成される |
| UV | young/hot stars、電離interface | 色だけで年齢や温度を一意に決めない |
| X-ray | 高温shock、energetic plasma、非熱的粒子 | 青いplasmaという自然色ではない |

## 制作契約

- physical scene、measurement/tracer layer、display layerを分ける。
- gas、dust、stars、shockを一つのworld-spaceへ置き、camera変更時は全て同じ投影を受ける。
- 発光、反射、吸収を一つのfog shaderへ混ぜない。
- 色、stretch、時間補間、3D奥行きが創作なら astronomical-data-inspired / artistic mapping; not a scientific observation と表記する。
- scientific visualizationを名乗るなら、target、observation ID、instrument、filter／line、calibration version、projection、color map、stretch、alignment、radioならuv/deconvolutionまで必要になる。

## 主要source

- NASA, Visualization: From Energy to Image. https://science.nasa.gov/ems/04_energytoimage/
- STScI, JWST Science Calibration Pipeline. https://jwst-docs.stsci.edu/jwst-science-calibration-pipeline
- NASA, How Are Webb’s Full-Color Images Made? https://science.nasa.gov/mission/webb/science-overview/science-explainers/how-are-webbs-full-color-images-made/
- NASA, Sensing the Universe. https://science.nasa.gov/universe/sensing-the-universe/
- NASA, The Electromagnetic Spectrum with Hubble, Webb, and Spitzer. https://science.nasa.gov/asset/webb/the-electromagnetic-spectrum-with-hubble-webb-and-spitzer-highlights/
- Chandra X-ray Center, Adding Color to Chandra Images. https://chandra.si.edu/photo/false_color.html
- STScI, Astronomical Outreach Imaging Workshop: Data to Pictures 101. https://www.stsci.edu/contents/events/stsci/2003/september/astronomical-outreach-imaging-workshop
- ESA, What is red shift? https://www.esa.int/Science_Exploration/Space_Science/What_is_red_shift
- NASA Hubble, Gravitational Lenses. https://science.nasa.gov/mission/hubble/science/science-behind-the-discoveries/hubble-gravitational-lenses/
- ALMA/NRAO, APerture SYNthesis Simulator. https://almascience.nrao.edu/tools/eu-arc-network/i-train

