import tckJSON from "./tck.json";

const map: Record<string, Record<string, string[]>> = {};

const cateogryMap: Record<string, string[]> = {};
tckJSON.forEach((item) => {
  const { path, file_name } = item;
  map[path] = map[path] || {};
  // filter 300 length
  map[path][file_name] = item.statements.filter(
    (statement) => statement.length < 400
  );
  cateogryMap[file_name] = map[path][file_name];
});
const category = {};
for (const path in map) {
  category[path] = Object.keys(map[path]);
}
const categoryString = JSON.stringify(category).replace(/"/g, "");
export default {
  map,
  cateogryMap,
  categoryString,
};
