export const clusterPalette = [
  "#58c9f5",
  "#ffad59",
  "#b198ed",
  "#63d5c6",
  "#f17b9a",
  "#e7d27c",
  "#7fa9ff",
  "#a4d58b",
];
export function subjectHash(subject: string) {
  let n = 0;
  for (const c of subject) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}
const regions: Record<string, [number, number, number]> = {
  Science: [-210, 105, 0],
  "Machine Learning": [140, 100, 1],
  Philosophy: [-65, -95, 2],
  Mathematics: [230, -85, 3],
  Fiction: [-250, -125, 4],
  History: [10, 200, 5],
  "Computer Science": [300, 175, 6],
  Cooking: [50, -210, 7],
};
export function clusterPosition(subject: string) {
  const hash = subjectHash(subject);
  const known = regions[subject];
  const angle = ((hash % 3600) * Math.PI) / 1800;
  const index = known?.[2] ?? hash % 8;
  return {
    x: known?.[0] ?? Math.cos(angle) * 290,
    y: known?.[1] ?? Math.sin(angle) * 205,
    z: Math.sin(index * 2.3) * 55,
    color: clusterPalette[index],
  };
}
