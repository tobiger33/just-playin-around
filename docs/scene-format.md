# Scene format

Scene files use the JSON Schema in `schema/scene.schema.json` and set
`"version": 1`.

The runtime and `validate-scene` CLI treat a missing version as version 1 for
backward compatibility. Explicit versions other than 1 are rejected. When a
future schema changes incompatibly, it must receive a new version and a
documented migration path; consumers must not silently interpret an unknown
version as version 1.
