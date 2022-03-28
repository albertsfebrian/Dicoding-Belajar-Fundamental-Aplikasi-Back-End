const mapDBToModel = ({
  id,
  name,
  year,
  cover,
  created_at,
  updated_at,
}) => ({
  id,
  name,
  year,
  coverUrl: cover,
  createdAt: created_at,
  updatedAt: updated_at,
});

module.exports = { mapDBToModel };
