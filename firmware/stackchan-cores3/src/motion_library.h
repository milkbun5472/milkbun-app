#pragma once

#include <Arduino.h>
#include <cstring>

// Stack-chan motion library.
//
// The official M5Stack firmware represents choreography as a keyframe
// timeline.  Keep the same useful idea here, but use conservative,
// home-relative angles that have already proved safe on Lisa's CoreS3 body.
struct MotionFrame {
  int8_t yawOffset;
  int8_t pitchOffset;
  uint16_t durationMs;
};

enum class MotionMode : uint8_t {
  OneShot,
  EnterStudy,
  StudyPage,
  ExitStudy,
};

struct MotionSequence {
  const char* name;
  const MotionFrame* frames;
  size_t frameCount;
  MotionMode mode;
};

namespace MotionLibrary {
inline constexpr MotionFrame kNod[] = {
    {0, 12, 260}, {0, 1, 240}, {0, 11, 240}, {0, 0, 300},
};
inline constexpr MotionFrame kShake[] = {
    {-20, 4, 260}, {20, 4, 360}, {-16, 3, 320},
    {13, 2, 280}, {0, 0, 320},
};
inline constexpr MotionFrame kLookAround[] = {
    {-27, 7, 520}, {-27, 15, 350}, {25, 12, 650},
    {12, 3, 380}, {0, 0, 450},
};
inline constexpr MotionFrame kHappyBounce[] = {
    {-11, 9, 190}, {11, 3, 190}, {-9, 10, 180},
    {9, 3, 180}, {0, 0, 300},
};
inline constexpr MotionFrame kShy[] = {
    {22, 2, 520}, {16, 8, 420}, {24, 4, 320},
    {8, 2, 420}, {0, 0, 420},
};
inline constexpr MotionFrame kWakeUp[] = {
    {0, 2, 500}, {-8, 12, 360}, {8, 15, 340},
    {0, 8, 300}, {0, 0, 380},
};
inline constexpr MotionFrame kListen[] = {
    {-8, 12, 360}, {7, 13, 420}, {0, 10, 340}, {0, 0, 360},
};

// Official-animation-inspired additions, deliberately reduced to the body's
// already-tested relay limits.
inline constexpr MotionFrame kHappyDance[] = {
    {-22, 5, 230}, {22, 11, 230}, {-18, 4, 210},
    {18, 12, 210}, {0, 0, 360},
};
inline constexpr MotionFrame kRobot[] = {
    {-28, 3, 300}, {-28, 15, 220}, {0, 15, 260},
    {28, 15, 300}, {28, 3, 220}, {0, 0, 380},
};
inline constexpr MotionFrame kPanic[] = {
    {-25, 15, 170}, {25, 7, 170}, {-22, 16, 160},
    {22, 6, 160}, {-12, 12, 150}, {12, 7, 150}, {0, 0, 360},
};
inline constexpr MotionFrame kThinkingTilt[] = {
    {-10, 5, 420}, {-13, 9, 360}, {-8, 6, 420}, {0, 0, 360},
};
inline constexpr MotionFrame kSoftSway[] = {
    {-8, 5, 440}, {8, 7, 520}, {-4, 4, 420}, {0, 0, 380},
};
inline constexpr MotionFrame kWilt[] = {
    {4, 5, 360}, {7, 14, 520}, {4, 17, 460}, {0, 0, 520},
};

// Study is a persistent mode. EnterStudy intentionally does not return home;
// StudyPage returns to the reading pose; ExitStudy looks up and settles home.
inline constexpr MotionFrame kStudyRead[] = {
    {-5, 5, 420}, {4, 13, 420}, {-3, 18, 520},
};
inline constexpr MotionFrame kStudyPage[] = {
    {-3, 18, 180}, {5, 20, 220}, {-6, 17, 240}, {-3, 18, 280},
};
inline constexpr MotionFrame kStudyLookUp[] = {
    {-3, 18, 180}, {0, 8, 360}, {0, 0, 420},
};

#define MOTION_ENTRY(name, frames, mode) \
  {name, frames, sizeof(frames) / sizeof(frames[0]), mode}

inline constexpr MotionSequence kSequences[] = {
    MOTION_ENTRY("nod", kNod, MotionMode::OneShot),
    MOTION_ENTRY("shake", kShake, MotionMode::OneShot),
    MOTION_ENTRY("look_around", kLookAround, MotionMode::OneShot),
    MOTION_ENTRY("happy_bounce", kHappyBounce, MotionMode::OneShot),
    MOTION_ENTRY("shy", kShy, MotionMode::OneShot),
    MOTION_ENTRY("wake_up", kWakeUp, MotionMode::OneShot),
    MOTION_ENTRY("listen", kListen, MotionMode::OneShot),
    MOTION_ENTRY("happy_dance", kHappyDance, MotionMode::OneShot),
    MOTION_ENTRY("robot", kRobot, MotionMode::OneShot),
    MOTION_ENTRY("panic", kPanic, MotionMode::OneShot),
    MOTION_ENTRY("thinking_tilt", kThinkingTilt, MotionMode::OneShot),
    MOTION_ENTRY("soft_sway", kSoftSway, MotionMode::OneShot),
    MOTION_ENTRY("wilt", kWilt, MotionMode::OneShot),
    MOTION_ENTRY("study_read", kStudyRead, MotionMode::EnterStudy),
    MOTION_ENTRY("study_page", kStudyPage, MotionMode::StudyPage),
    MOTION_ENTRY("study_lookup", kStudyLookUp, MotionMode::ExitStudy),
};

#undef MOTION_ENTRY

inline const MotionSequence* find(const char* name) {
  if (!name) return nullptr;
  for (const auto& sequence : kSequences) {
    if (std::strcmp(sequence.name, name) == 0) return &sequence;
  }
  return nullptr;
}
}  // namespace MotionLibrary
