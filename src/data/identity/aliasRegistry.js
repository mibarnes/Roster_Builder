export const createAliasRegistry = (seed = {}) => {
  const map = new Map(Object.entries(seed));

  const putAlias = ({ sourceType, externalId, playerId }) => {
    map.set(`${sourceType}:${externalId}`, playerId);
  };

  const resolveAlias = ({ sourceType, externalId }) => map.get(`${sourceType}:${externalId}`);

  return {
    putAlias,
    resolveAlias,
    toJSON: () => Object.fromEntries(map.entries())
  };
};
