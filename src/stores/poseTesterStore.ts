import { create } from 'zustand'

// Bones the pose tester can drive. Names match the dot-stripped form that
// three.js's GLTFLoader produces (e.g. `upper_arm.L` → `upper_armL`).
export const TESTABLE_BONES = [
  'upper_armL', 'upper_armR',
  'forearmL', 'forearmR',
  'handL', 'handR',
  'thighL', 'thighR',
  'shinL', 'shinR',
  'spine003', 'face',
] as const
export type TestableBone = (typeof TESTABLE_BONES)[number]

export interface BoneOverride { x: number; y: number; z: number }

interface PoseTesterState {
  enabled: boolean
  overrides: Record<TestableBone, BoneOverride>
  setEnabled: (b: boolean) => void
  setBoneAxis: (bone: TestableBone, axis: 'x' | 'y' | 'z', value: number) => void
  reset: () => void
}

const initialOverrides = Object.fromEntries(
  TESTABLE_BONES.map((n) => [n, { x: 0, y: 0, z: 0 }])
) as Record<TestableBone, BoneOverride>

export const usePoseTesterStore = create<PoseTesterState>((set) => ({
  enabled: false,
  overrides: initialOverrides,
  setEnabled: (b) => set({ enabled: b }),
  setBoneAxis: (bone, axis, value) =>
    set((s) => ({
      overrides: {
        ...s.overrides,
        [bone]: { ...s.overrides[bone], [axis]: value },
      },
    })),
  reset: () => set({ overrides: initialOverrides }),
}))
