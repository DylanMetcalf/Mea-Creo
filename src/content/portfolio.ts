/**
 * Mea Creo photography, imported from the previous website (meacreo.co.za portfolio pages).
 * Files live in public/portfolio. Matric dance photos were deliberately not imported: they
 * show school-leavers, some likely under 18, which needs guardian consent under POPIA.
 */
export const PORTFOLIO_CATEGORIES = {
  food: "Food",
  landscape: "Landscape",
  "lodge-and-travel": "Lodge & travel",
  photoshoots: "Photoshoots",
  wildlife: "Wildlife",
} as const;
export type PortfolioCategory = keyof typeof PORTFOLIO_CATEGORIES;

export interface PortfolioPhoto {
  src: string;
  category: PortfolioCategory;
  width: number;
  height: number;
}

export const PORTFOLIO_PHOTOS: PortfolioPhoto[] = [
  { src: "/portfolio/food-01.jpg", category: "food", width: 1600, height: 825 },
  { src: "/portfolio/food-02.jpg", category: "food", width: 1600, height: 1600 },
  { src: "/portfolio/food-03.jpg", category: "food", width: 1600, height: 1200 },
  { src: "/portfolio/food-04.jpg", category: "food", width: 667, height: 1000 },
  { src: "/portfolio/food-05.jpg", category: "food", width: 1600, height: 1600 },
  { src: "/portfolio/food-06.jpg", category: "food", width: 1600, height: 1067 },
  { src: "/portfolio/food-07.jpg", category: "food", width: 667, height: 1000 },
  { src: "/portfolio/food-08.jpg", category: "food", width: 1067, height: 1600 },
  { src: "/portfolio/food-09.jpg", category: "food", width: 667, height: 1000 },
  { src: "/portfolio/food-10.jpg", category: "food", width: 1600, height: 1600 },
  { src: "/portfolio/food-11.jpg", category: "food", width: 667, height: 1000 },
  { src: "/portfolio/food-12.jpg", category: "food", width: 1000, height: 667 },
  { src: "/portfolio/food-13.jpg", category: "food", width: 667, height: 1000 },
  { src: "/portfolio/food-14.jpg", category: "food", width: 667, height: 1000 },
  { src: "/portfolio/food-15.jpg", category: "food", width: 667, height: 1000 },
  { src: "/portfolio/landscape-01.jpg", category: "landscape", width: 1600, height: 1068 },
  { src: "/portfolio/landscape-02.jpg", category: "landscape", width: 1600, height: 1200 },
  { src: "/portfolio/landscape-03.jpg", category: "landscape", width: 1600, height: 1067 },
  { src: "/portfolio/landscape-04.jpg", category: "landscape", width: 1067, height: 1600 },
  { src: "/portfolio/landscape-05.jpg", category: "landscape", width: 1600, height: 1200 },
  { src: "/portfolio/landscape-06.jpg", category: "landscape", width: 1600, height: 1067 },
  { src: "/portfolio/landscape-07.jpg", category: "landscape", width: 1600, height: 1067 },
  { src: "/portfolio/landscape-08.jpg", category: "landscape", width: 1067, height: 1600 },
  { src: "/portfolio/landscape-09.jpg", category: "landscape", width: 1600, height: 1067 },
  { src: "/portfolio/landscape-10.jpg", category: "landscape", width: 1600, height: 1067 },
  {
    src: "/portfolio/lodge-and-travel-01.jpg",
    category: "lodge-and-travel",
    width: 1067,
    height: 1600,
  },
  {
    src: "/portfolio/lodge-and-travel-02.jpg",
    category: "lodge-and-travel",
    width: 1600,
    height: 1067,
  },
  {
    src: "/portfolio/lodge-and-travel-03.jpg",
    category: "lodge-and-travel",
    width: 1067,
    height: 1600,
  },
  {
    src: "/portfolio/lodge-and-travel-04.jpg",
    category: "lodge-and-travel",
    width: 1600,
    height: 1067,
  },
  {
    src: "/portfolio/lodge-and-travel-05.jpg",
    category: "lodge-and-travel",
    width: 1067,
    height: 1600,
  },
  {
    src: "/portfolio/lodge-and-travel-06.jpg",
    category: "lodge-and-travel",
    width: 1600,
    height: 1066,
  },
  {
    src: "/portfolio/lodge-and-travel-07.jpg",
    category: "lodge-and-travel",
    width: 1600,
    height: 1200,
  },
  {
    src: "/portfolio/lodge-and-travel-08.jpg",
    category: "lodge-and-travel",
    width: 1067,
    height: 1600,
  },
  {
    src: "/portfolio/lodge-and-travel-09.jpg",
    category: "lodge-and-travel",
    width: 1600,
    height: 1067,
  },
  {
    src: "/portfolio/lodge-and-travel-10.jpg",
    category: "lodge-and-travel",
    width: 1600,
    height: 1600,
  },
  {
    src: "/portfolio/lodge-and-travel-11.jpg",
    category: "lodge-and-travel",
    width: 1600,
    height: 1066,
  },
  {
    src: "/portfolio/lodge-and-travel-12.jpg",
    category: "lodge-and-travel",
    width: 1600,
    height: 1066,
  },
  {
    src: "/portfolio/lodge-and-travel-13.jpg",
    category: "lodge-and-travel",
    width: 1600,
    height: 1067,
  },
  {
    src: "/portfolio/lodge-and-travel-14.jpg",
    category: "lodge-and-travel",
    width: 1600,
    height: 1200,
  },
  {
    src: "/portfolio/lodge-and-travel-15.jpg",
    category: "lodge-and-travel",
    width: 1600,
    height: 1067,
  },
  { src: "/portfolio/photoshoots-01.jpg", category: "photoshoots", width: 1200, height: 1600 },
  { src: "/portfolio/photoshoots-02.jpg", category: "photoshoots", width: 1600, height: 1067 },
  { src: "/portfolio/photoshoots-03.jpg", category: "photoshoots", width: 1067, height: 1600 },
  { src: "/portfolio/photoshoots-04.jpg", category: "photoshoots", width: 1067, height: 1600 },
  { src: "/portfolio/photoshoots-05.jpg", category: "photoshoots", width: 1067, height: 1600 },
  { src: "/portfolio/photoshoots-06.jpg", category: "photoshoots", width: 1066, height: 1600 },
  { src: "/portfolio/photoshoots-07.jpg", category: "photoshoots", width: 1067, height: 1600 },
  { src: "/portfolio/photoshoots-08.jpg", category: "photoshoots", width: 1067, height: 1600 },
  { src: "/portfolio/photoshoots-09.jpg", category: "photoshoots", width: 1067, height: 1600 },
  { src: "/portfolio/photoshoots-10.jpg", category: "photoshoots", width: 1067, height: 1600 },
  { src: "/portfolio/photoshoots-11.jpg", category: "photoshoots", width: 1600, height: 1067 },
  { src: "/portfolio/photoshoots-12.jpg", category: "photoshoots", width: 1067, height: 1600 },
  { src: "/portfolio/photoshoots-13.jpg", category: "photoshoots", width: 1600, height: 900 },
  { src: "/portfolio/photoshoots-14.jpg", category: "photoshoots", width: 1600, height: 900 },
  { src: "/portfolio/photoshoots-15.jpg", category: "photoshoots", width: 1200, height: 1600 },
  { src: "/portfolio/photoshoots-16.jpg", category: "photoshoots", width: 900, height: 1600 },
  { src: "/portfolio/wildlife-01.jpg", category: "wildlife", width: 1067, height: 1600 },
  { src: "/portfolio/wildlife-02.jpg", category: "wildlife", width: 900, height: 1600 },
  { src: "/portfolio/wildlife-03.jpg", category: "wildlife", width: 1600, height: 1200 },
  { src: "/portfolio/wildlife-04.jpg", category: "wildlife", width: 1067, height: 1600 },
  { src: "/portfolio/wildlife-05.jpg", category: "wildlife", width: 1067, height: 1600 },
  { src: "/portfolio/wildlife-06.jpg", category: "wildlife", width: 1067, height: 1600 },
  { src: "/portfolio/wildlife-07.jpg", category: "wildlife", width: 1067, height: 1600 },
  { src: "/portfolio/wildlife-08.jpg", category: "wildlife", width: 1067, height: 1600 },
  { src: "/portfolio/wildlife-09.jpg", category: "wildlife", width: 1600, height: 1600 },
  { src: "/portfolio/wildlife-10.jpg", category: "wildlife", width: 1067, height: 1600 },
  { src: "/portfolio/wildlife-11.jpg", category: "wildlife", width: 1067, height: 1600 },
  { src: "/portfolio/wildlife-12.jpg", category: "wildlife", width: 1067, height: 1600 },
  { src: "/portfolio/wildlife-13.jpg", category: "wildlife", width: 1067, height: 1600 },
  { src: "/portfolio/wildlife-14.jpg", category: "wildlife", width: 1067, height: 1600 },
  { src: "/portfolio/wildlife-15.jpg", category: "wildlife", width: 1600, height: 1600 },
];
