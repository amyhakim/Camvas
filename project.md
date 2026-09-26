Yes — and this reframing is much stronger. What you're describing is basically AI-native previs / stuntvis, not an AI video generator.
Movie directors generally do not jump from script → shoot. For complicated sequences, there’s an increasingly detailed planning pipeline:
Script / director's intent → storyboards → blocking → previs → techvis/stuntvis → rehearsal → shoot.
A director also isn't doing all of this alone. The director works with the DP, stunt coordinator/action designer, storyboard artists, previs artists, VFX supervisor, camera/grip departments, etc.
1. Storyboards: “What shots do I want?”
Very early, they'll draw panels representing the sequence:
SHOT 12

          bad guy
             X

        → HERO
          X

   [ CAMERA ]

The storyboard communicates composition, approximate action, angle and narrative beats.
A shot list might additionally specify:
24mm wide
low angle
dolly forward
hero enters left
explosion after 3 seconds

Modern tools like StudioBinder already combine storyboards with notes about camera position, actor movement, shot types, lenses and frame rates. StudioBinder
But it's still fundamentally 2D.
2. Blocking: “Where is everyone physically?”
Director + actors work out:
TOP VIEW

             Villain
                ●
                ↓

      table ████████

Hero ● ─────────────→

             🎥

Where does the actor walk?
Where do they stop?
Where does the camera go?
When does dialogue happen?
This is where your Blockout-style environment becomes immediately useful.
3. Previs: “Show me roughly what the scene will look like.”
For complex movies, they build a crude 3D version of the scene.
Characters might literally look like game characters.
Quality doesn't matter much.
What matters is:
actor movement
+
camera position
+
camera trajectory
+
lens
+
timing
+
editing

And then they effectively make an ugly version of the movie before filming the movie.
Unreal describes previs exactly this way: rough out the visuals/action before shooting so filmmakers can experiment with how the script will be visually presented. Unreal Engine
Marvel-scale productions go extremely far with this. Avengers: Infinity War, for example, reportedly had thousands of previs shots used to develop fights, story flow and camera ideas. THE THIRD FLOOR
That's very close to what you're imagining.
4. Action scenes add stuntvis
This is where it gets particularly relevant.
Imagine:
Hero runs → jumps over car → villain punches → camera circles → explosion → hero falls.

You don't want the first time everyone understands that sequence to be when there are stunt performers, explosives, camera cranes and 100 crew members waiting.
So they previsualize:
                 VILLAIN
                    ●
                    ↓
             punch @ 4.2s

 CAR  ███████████████████

      HERO
       ● ─────→ jump
                 @ 2.7s


CAMERA 🎥 ╭───────────────╮
          ╰───────────────→

Stuntvis can cover actor choreography, camera placement/movement, props, rigging, stunt testing and set layout. Unreal Engine
That's why it exists: action choreography and camera choreography are interdependent.
You can't really design them independently.
5. Then there's techvis
Once everyone likes the creative version, somebody has to answer:
Can we actually shoot this?

Now you care about:
Camera:
Alexa 35, 24mm, camera height 1.7m.
Rig:
30-foot Technocrane.
Movement:
camera travels 14m in 6.2 sec.
Actor:
starts here, finishes there.
Set:
wall is 3m away.
Safety:
camera cannot cross stunt-wire area.
This is techvis.
The Third Floor describes using techvis to answer things as specific as how fast/high a camera needs to move and to map crane/camera positions relative to performers. THE THIRD FLOOR
So the full progression is approximately:
IDEA

"Crazy fight through a hotel lobby"

        ↓

STORYBOARD

"What does each shot look like?"

        ↓

BLOCKING

"Where does everybody move?"

        ↓

PREVIS

"Let's watch a rough version."

        ↓

STUNTVIS

"Does the physical action work?"

        ↓

TECHVIS

"How exactly do we shoot it?"

        ↓

REAL PRODUCTION

And now I see a much clearer project for you
Don't position it as:
AI generates camera trajectories.

That's CinemaTraj territory.
And don't position it as:
AI makes videos.

That's Seedance territory.
Build:
An AI previs director
You give it:
“Two characters fight through this apartment. Start handheld behind Alice, reveal Bob around the kitchen island, follow them into the living room, then crane upward when Bob gets thrown through the table.”

The agent gets a rough 3D location and actors.
Then collaboratively constructs:
            SCENE

        Bob ●
            │
 kitchen    │
 █████      ↓

       Alice ● ────────→

                ╭───────────── 🎥
                │
         🎥 ────╯

---------------------------------

TIMELINE

0s       2s       4s       6s       8s

Alice ── walks ── punch ── throw ──────

Bob   ── reveal ─ block ── fall ───────

Cam   dolly ───── orbit ─── crane ↑────

And the director can iterate conversationally:
“No, I want the audience to see Bob earlier.”

Agent updates blocking + camera.
“Make it feel more claustrophobic.”

Maybe it changes lens, camera distance and path.
“Can this be shot with a handheld camera instead of a crane?”

Now the system constrains the choreography accordingly.
“Move the punch before the camera crosses Alice.”

Timeline updates.
That is much more interesting than one-shot generation.
Blockout becomes your canvas
And this is why I think your instinct about scene board + Blockout + camera is right.
The UI could effectively have three synchronized views:
┌──────────────────────────────────────────────┐
│                 CAMERA VIEW                  │
│                                              │
│             rough previs playback            │
│                                              │
└──────────────────────────────────────────────┘

┌───────────────────────┬──────────────────────┐
│      TOP-DOWN         │       TIMELINE       │
│                       │                      │
│   Alice → ●           │ Alice ───────→      │
│           Bob ●       │ Bob   ─ punch       │
│                       │ Camera ───╮          │
│   🎥 ═══════→         │           ╰────→    │
│                       │                      │
└───────────────────────┴──────────────────────┘

That's not just a video generator.
It's a creative planning environment.
And Seedance has a very sensible role
Once the director likes the crude previs:
BLOCKOUT
   ↓
ugly but spatially precise previs
   ↓
Seedance
   ↓
cinematic concept render

So suddenly the director can see something approaching:
“What would this actually feel like?”

without treating the generative result as ground truth.
That's important.
Your structured scene stays the source of truth.
Seedance is the visualization layer.
Then if this were actually going to production, the same structured scene could output:
Shot 14
35mm
camera start XYZ
camera end XYZ
duration 5.4s
Alice path
Bob path
action cue at 3.2s

A human crew can execute that.
That's the product gap I'd target.
Existing professional workflows can already do all of this through talented previs teams using Unreal/Maya/etc. The Third Floor has examples where approved previs was turned into precise techvis diagrams for the physical shoot. THE THIRD FLOOR
The interesting question for 2026 is:
What if a director could explore those ideas themselves by talking to an agent instead of waiting for a previs artist to manually implement every iteration?

That's a real workflow improvement.
And it makes a fantastic ShellHacks demo:
Prompt → AI blocks the actors → AI proposes camera choreography → director says “orbit behind him instead” → scene updates → play previs → optionally hit “Render Concept” → Seedance beautifies it → hit “Production View” → get the actual camera/actor plan.
Now you aren't competing with Seedance.
You're building the creative control layer above it, while also producing something useful even if no generative video model ever touches the project.