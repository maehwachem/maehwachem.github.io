/* J2000 positions and reference V magnitudes: IAU WGSN official archive. */
(function(root){ const stars = [
  {
    "name": "베가",
    "latin": "Vega",
    "constellation": "거문고자리",
    "ra": 18.615649,
    "dec": 38.783689,
    "mag": 0.03
  },
  {
    "name": "데네브",
    "latin": "Deneb",
    "constellation": "백조자리",
    "ra": 20.690532,
    "dec": 45.280339,
    "mag": 1.25
  },
  {
    "name": "알타이르",
    "latin": "Altair",
    "constellation": "독수리자리",
    "ra": 19.8463884667,
    "dec": 8.868321,
    "mag": 0.76
  },
  {
    "name": "포말하우트",
    "latin": "Fomalhaut",
    "constellation": "남쪽물고기자리",
    "ra": 22.9608462,
    "dec": -29.622237,
    "mag": 1.17
  },
  {
    "name": "카펠라",
    "latin": "Capella",
    "constellation": "마차부자리",
    "ra": 5.2781552,
    "dec": 45.997991,
    "mag": 0.08
  },
  {
    "name": "시리우스",
    "latin": "Sirius",
    "constellation": "큰개자리",
    "ra": 6.752477,
    "dec": -16.716116,
    "mag": -1.44
  },
  {
    "name": "베텔게우스",
    "latin": "Betelgeuse",
    "constellation": "오리온자리",
    "ra": 5.9195292667,
    "dec": 7.407064,
    "mag": 0.45
  },
  {
    "name": "알데바란",
    "latin": "Aldebaran",
    "constellation": "황소자리",
    "ra": 4.5986775333,
    "dec": 16.509302,
    "mag": 0.87
  },
  {
    "name": "레굴루스",
    "latin": "Regulus",
    "constellation": "사자자리",
    "ra": 10.1395308,
    "dec": 11.967209,
    "mag": 1.36
  },
  {
    "name": "스피카",
    "latin": "Spica",
    "constellation": "처녀자리",
    "ra": 13.4198831333,
    "dec": -11.161319,
    "mag": 0.98
  },
  {
    "name": "아르크투루스",
    "latin": "Arcturus",
    "constellation": "목동자리",
    "ra": 14.26102,
    "dec": 19.182409,
    "mag": -0.05
  },
  {
    "name": "안타레스",
    "latin": "Antares",
    "constellation": "전갈자리",
    "ra": 16.4901276667,
    "dec": -26.432003,
    "mag": 1.06
  },
  {
    "name": "북극성",
    "latin": "Polaris",
    "constellation": "작은곰자리",
    "ra": 2.5303040667,
    "dec": 89.264109,
    "mag": 1.97
  }
]
; if(typeof module === "object" && module.exports) module.exports=stars; else root.SkyStars=stars; })(typeof globalThis !== "undefined" ? globalThis : self);
