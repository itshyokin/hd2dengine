# Building 3D maps in Blender

A **3D map** is a whole place you model in Blender and walk through in third person. Blender does the place itself
(the ground, buildings, rocks, trees, water); the engine does everything that happens there (events, music, sounds,
battles, encounters, weather, the time of day).

## 1. Model it

- **Scale:** 1 Blender metre = 1 engine unit (one tile). Characters are about 1.6–1.8 m tall, so model at real size:
  doors about 2.2 m high, steps about 0.2 m high and 0.3 m deep, corridors at least 1.5 m wide.
- **Which way is north:** Blender's **+Y** is north (up on the map) and **+X** is east. The engine moves the scene so
  its south-west corner sits at the map's top-left tile, so you can model around Blender's origin.
- **Floors over floors are fine:** bridges over paths, balconies, caves under hills. The hero walks on whatever is
  under their feet.
- **Ramps and stairs:** slopes up to about 45° can be walked up; stairs work if each step is no taller than about
  0.3 m (a smooth ramp hidden under the steps, tagged `_col`, makes them feel smoother).

## 2. Name things (tags)

Put the tag anywhere in the **object's name** (or its parent's), or in the **material's name** where it says so.
Upper or lower case doesn't matter, and `Rock_col`, `col_Rock` and `Rock.col` all count.

| Tag | Put it on | What it does |
| --- | --- | --- |
| `_col` | object | **Collision only**, invisible. As soon as the scene has any `_col` object, *only* `_col` objects collide: make simple boxes and ramps around your detailed models (like Halo's collision geometry). Without any, every visible mesh collides. |
| `_nocol` | object | Shown, never collided with: tall grass, cobwebs, hanging vines, light shafts. |
| `_nocam` | object | Collides, but the camera passes through it instead of zooming in: leaves, thin poles, fences. |
| `_foliage` | **material** | Sways in the wind (the same wind as the 2D maps). With vertex colours, paint **red** where it should move most (leaf tips) and **black** where it shouldn't (trunks); without, it all sways a little. |
| `_water` | object (a flat plane) | A **water surface**: deeper than about chest height, the hero swims; jumping in splashes. The plane's height is the surface. Not collided with: model the bottom of the pond or river under it. |
| `_waterfall` | object (a plane) | Falling water: its texture runs downwards and it's heard nearby. |
| `_killzone` | object (a box) | Pits and the void: falling into it puts the hero back on the last safe ground. Invisible. Falling far below the whole scene does the same anyway. |
| `start` | an **empty** (or any object) named `start` | Where the hero appears when nothing else says (a transfer or the game's start point decides first). |
| `trigger_…` | a **box** named e.g. `trigger_door` | Becomes a **trigger volume** (invisible) the editor can bring in: pick the event it runs there. |
| `encounter_…` | a **box** named e.g. `encounter_A_cave` | Becomes an **encounter volume**: the letter after `encounter_` is its encounter zone (A here). |

Coming later: `_ladder` (climbable).

## 3. Export

**File → Export → glTF 2.0**, format **glTF Binary (.glb)**, with:

- **Include:** Selected Objects off (the whole scene), **Custom Properties** on.
- **Transform:** **+Y Up** on (the default).
- **Mesh:** Apply Modifiers on, UVs, Normals, **Vertex Colors** on (for `_foliage` sway weights), Materials: Export.

Keep textures small where you can (1024 × 1024 is plenty for most things). Baked lighting looks great and costs
nothing: bake shadows and light into the textures in Blender, and the engine adds its own day and night, lights and
weather on top.

## 4. Bring it in

1. In the Map Editor, make a map (**New map**) big enough to cover the scene in tiles (a 60 × 40 m scene needs a map
   of at least 60 × 40), then open **⚙ Map Properties → 3D map (Blender scene) → Choose…** and pick the `.glb`. It's
   saved in the project as `assets/maps/<map>_3d.glb`, and the editor tells you how big it is.
2. Click **3D view** in the toolbar to see the scene in 3D:
   - **Fly:** hold the right mouse button and drag to look; **W A S D** move, **Q / E** down / up, **Shift** faster;
     the wheel moves forward and back.
   - **Place:** right-click a spot (without dragging) → **New event here…**, then pick its kind on the left (an
     event, a transfer, a chest, an enemy…): it stands exactly on that spot, on whatever floor you clicked. **Move
     the player's start here** does what it says.
   - **Select and move:** click an event, a volume or the green player start; the **Move / Turn / Size** buttons
     (top right, or **W / E / R**) pick what the gizmo does: drag its arrows to move, its ring to turn (the start's
     facing snaps to the nearest of the four ways), its handles to size (volumes). **F** frames it; double-click opens
     an event's pages and commands. Its settings show in the left bar.
   - In the game, a *talk* event is talked to from in front of it (at about the same height), and a *touch* event
     fires when the hero walks into it.
   - **Volumes:** right-click → **Trigger volume here** (runs an event's page when the hero walks in, or out; once
     ever or every time) or **Encounter volume here** (random battles inside: it counts as one of the map's encounter
     zones, with that zone's troops and rate from Map Properties → Encounters). Select one to move it (**W**), turn
     it (**E**) or size it (**R**); Delete removes it. Boxes named `trigger_…` / `encounter_…` in Blender come in with
     **Bring in N volumes from Blender** (top left of the 3D view).
   - **Monsters:** right-click → New event here → *Create enemy here*: it roams and chases on the scene's floors and
     starts its battle when it touches the hero. Map Properties → Encounters still gives the whole map random battles
     (a Pokémon cave).
   The 2D map (the toolbar's 3D view button again) shows the scene from above, and events can still be placed on its
   tiles. Music, sounds, weather, battles and encounters are set in Map Properties as usual.
3. **▶ Playtest.** The camera orbits the hero: drag with the mouse (or use the right stick) to turn it, and the wheel
   zooms. Database → World → View & camera → *Camera on 3D maps* can switch it to **Follow** (it settles behind the
   hero as they walk). Either way it never looks up from under the ground or straight down.

To change the place, edit it in Blender, export over the same file and choose it again (or replace the file in
`public/assets/maps/`).
