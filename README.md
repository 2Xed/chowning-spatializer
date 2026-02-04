# chowning-spatializer
A spatial audio engine for Max4Live built in gen~ based on John Chowning’s algorithm for moving sound sources.

# Chowning Spatializer for Max/MSP (gen~)

A spatial audio engine for Max4Live implemented in gen~ (Max/MSP), based on John Chowning’s research: "The Simulation of Moving Sound Sources" (1977). 

This implementation provides a physically accurate 2D spatialization model, optimized for modern digital audio workstations and high-performance real-time processing.

---

## Key Features

* **Logarithmic Distance Mapping:** Distance control follows a power function to align with human psychoacoustic perception. A value of 0.5 on the distance fader represents the geometric mean (e.g., 10m in a 1m–100m range), providing a natural sound response.
* **Constant Power Panning:** Utilizes a trigonometric Sine/Cosine law to maintain equal power across the stereo field, eliminating the -3dB volume drop when the source is centered.
* **Doppler "Shift":** Simulates pitch-shifting based on radial velocity using delay lines with Cubic Spline Interpolation to prevent digital artifacts and aliasing.
* **Discrete Dry/Wet Architecture:** Features separate stereo outputs for the Direct Signal (Dry) and the Reverberation Send (Wet), allowing for external high-quality reverb processing.
* **48kHz/96kHz Optimized:** Dynamically adapts to the host sample rate. Buffers are pre-allocated to support up to 1300m distance at 48kHz (192,000 samples).

---

## Mathematical Implementation

The engine strictly follows the energy distribution laws defined by Chowning:

1.  **Direct Signal (Dry):** Attenuated by $1/D$ to simulate the physical inverse-distance law for sound pressure.
2.  **Global Reverb:** A mono-diffuse component scaled by $\frac{1}{\sqrt{D}} \cdot \frac{1}{D}$. This represents the sound energy that is reflected equally from all surfaces.
3.  **Local Reverb:** A directional component scaled by $\frac{1}{\sqrt{D}} \cdot (1 - \frac{1}{D})$. This preserves spatial localization in the reverberant field as the source moves away from the listener.
4.  **Angle of Incidence:** Mapped over $\pi/2$ radians (90°) per quadrant for precise trigonometric positioning.

---

## I/O Configuration

| Input | Description | Range |
| :--- | :--- | :--- |
| **In 1-2** | Stereo Audio Input | Audio Signal |
| **In 3** | Distance Control | 0.0 — 1.0 (Normalized) |
| **In 4** | Azimuth / Pan | -50 — 50 (Mapped to 0.0 — 1.0) |

| Output | Description | Destination |
| :--- | :--- | :--- |
| **Out 1-2** | Spatialized Direct Signal | Main Mix / Master Bus |
| **Out 3-4** | Spatialized Reverb Send | External Reverb Input (100% Wet) |

---

## Parameters (Defaults)

* `dist_min (1.0)`: Minimum distance unit. *Note: Must be greater than or equal to 1.0 to prevent phase inversion in local reverb formulas.*
* `dist_max (100.0)`: Maximum distance limit for the simulation.
* `speed_of_sound (343.4)`: Speed of propagation in m/s (Standard air at 20°C).
* `room_size (1.0)`: Global gain multiplier for the environmental energy.
* `smooth_time (2000)`: Slew-rate limiter in samples to ensure click-free modulation.

---

## Usage in Max for Live / Ableton

1.  Route **Outputs 3 and 4** to an external Return Track (**POST FADER**) containing a **Stereo Reverb** (set to 100% Wet and 0 ms predelay if you want to respect Chowning's mathematical equation).

---

## Reference
Chowning, J. M. (1977). *"The Simulation of Moving Sound Sources"*. Journal of the Audio Engineering Society.
Cycling '74 - Audio sender (Max4Live).

