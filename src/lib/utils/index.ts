export const required = <T>(value: T): NonNullable<T> => {
  if (value == null) {
    throw new Error("Required value is missing!");
  }

  return value;
};

export const replaceAt = <T>(array: T[], index: number, value: T) => {
  const copy = [...array];
  copy[index] = value;
  return copy;
};

export const removeAt = <T>(array: T[], index: number) => {
  return array.slice(0, index).concat(array.slice(index + 1));
};

export const addAt = <T>(array: T[], index: number, value: T) => {
  return array.slice(0, index).concat(value).concat(array.slice(index));
};

export const truncateText = (text: string, maxLength = 25) =>
  text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

// export const wait = async (ms: number) => {
//   return new Promise((resolve, reject) => {
//     setTimeout(() => {
//       resolve(undefined);
//     }, ms);
//   });
// };
