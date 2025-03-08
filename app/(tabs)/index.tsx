import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import {
  Canvas,
  Path,
  Circle,
  Group,
  Skia,
  usePathValue,
  vec,
  LinearGradient,
  RadialGradient,
  Shadow,
  Mask,
  Paint,
  Blur,
  CornerPathEffect,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useDerivedValue,
  runOnJS,
  withSpring,
  withTiming,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { useRef, useState } from 'react';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = width * 0.8;
const CIRCLE_STROKE_WIDTH = 70;
const INNER_CIRCLE_STROKE_WIDTH = CIRCLE_STROKE_WIDTH * 0.85;
const CIRCLE_RADIUS = (CIRCLE_SIZE - CIRCLE_STROKE_WIDTH) / 2;
const DOT_SIZE = 4;
const KNOB_SIZE = (INNER_CIRCLE_STROKE_WIDTH / 2) * 0.8;
const CENTER = CIRCLE_SIZE / 2;
const MAX_MONTHS = 12;

export default function HomeScreen() {
  // Add a React state for the display value - initialize with the same value as progressReanimated (0.33 * 12 = ~4)
  const [displayText, setDisplayText] = useState('4');

  // Reanimated values for gestures and animations
  const progressReanimated = useSharedValue(0.33); // Initial value (4 months / 12 months)
  const isPressed = useSharedValue(false);
  const screen = useWindowDimensions();

  // Display value (snapped to nearest month)
  const displayMonths = useDerivedValue(() => {
    // When pressed, show the exact value (rounded to nearest integer)
    if (isPressed.value) {
      return Math.round(progressReanimated.value * MAX_MONTHS);
    }
    // When not pressed, show the snapped value
    return Math.round(progressReanimated.value * MAX_MONTHS);
  });

  // For displaying decimal values during dragging
  const displayValue = useDerivedValue(() => {
    if (isPressed.value) {
      // During dragging, show the exact value as a whole number without decimals
      return Math.round(progressReanimated.value * MAX_MONTHS).toString();
    }
    // When not dragging, show the integer value
    return Math.round(progressReanimated.value * MAX_MONTHS).toString();
  });

  // Use animated reaction to update the React state
  useAnimatedReaction(
    () => displayValue.value,
    (currentValue) => {
      runOnJS(setDisplayText)(currentValue);
    }
  );

  // Create the arc path for the progress indicator using usePathValue
  const arcPath = usePathValue((path) => {
    'worklet';
    path.reset();
    const p = progressReanimated.value;
    const startAngle = -Math.PI / 2 / 1.06;
    const endAngle = -Math.PI / 2 + 2 * Math.PI * p;

    // Calculate the main arc points
    const arcRadius = CIRCLE_RADIUS;

    // Start point (flat cap)
    const startX = CENTER + Math.cos(startAngle) * arcRadius;
    const startY = CENTER + Math.sin(startAngle) * arcRadius;

    // End point
    const endX = CENTER + Math.cos(endAngle) * arcRadius;
    const endY = CENTER + Math.sin(endAngle) * arcRadius;

    // Draw the arc
    path.moveTo(startX, startY);

    // Draw the arc using small line segments
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / steps);
      const x = CENTER + Math.cos(angle) * arcRadius;
      const y = CENTER + Math.sin(angle) * arcRadius;
      path.lineTo(x, y);
    }

    return path;
  });

  // Calculate the position of the knob
  const knobX = useDerivedValue(() => {
    const p = progressReanimated.value;
    const angle = -Math.PI / 2 + 2 * Math.PI * p;
    return CENTER + Math.cos(angle) * CIRCLE_RADIUS;
  });

  const knobY = useDerivedValue(() => {
    const p = progressReanimated.value;
    const angle = -Math.PI / 2 + 2 * Math.PI * p;
    return CENTER + Math.sin(angle) * CIRCLE_RADIUS;
  });

  // Calculate the knob size with animation when pressed
  const knobSize = useDerivedValue(() => {
    return isPressed.value ? KNOB_SIZE * 1.05 : KNOB_SIZE;
  });

  // Create dots around the circle
  const dots = Array.from({ length: MAX_MONTHS }).map((_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / MAX_MONTHS;
    const x = CENTER + Math.cos(angle) * CIRCLE_RADIUS;
    const y = CENTER + Math.sin(angle) * CIRCLE_RADIUS;
    return { x, y, index };
  });

  // Reference to the canvas container view for measuring position
  const canvasRef = useRef(null);

  // Handle gestures
  const gesture = Gesture.Pan()
    .onBegin(() => {
      isPressed.value = true;
    })
    .onUpdate((e) => {
      if (!canvasRef.current) return;

      // Calculate the offset applied by the transform
      const offsetX = screen.width / 2 - CIRCLE_SIZE / 2;
      const offsetY = screen.height / 2 - CIRCLE_SIZE / 2;

      // Get the touch position relative to the canvas center, accounting for the offset
      const touchX = e.x - (CENTER + offsetX);
      const touchY = e.y - (CENTER + offsetY);

      // Calculate the angle in radians
      let angle = Math.atan2(touchY, touchX);

      // Normalize angle to start from the top (12 o'clock position)
      angle = (angle + Math.PI * 2.5) % (Math.PI * 2);

      // Convert angle to progress (0-1) - stepless during dragging
      let newProgress = angle / (2 * Math.PI);

      // Ensure the progress is within bounds
      newProgress = Math.max(1 / MAX_MONTHS, Math.min(1, newProgress));

      // Update progress - no snapping during drag
      progressReanimated.value = newProgress;
    })
    .onEnd((e) => {
      // Snap to nearest month when finger is lifted
      const nearestMonth =
        Math.round(progressReanimated.value * MAX_MONTHS) / MAX_MONTHS;
      progressReanimated.value = withTiming(nearestMonth, {
        duration: 100,
      });
      isPressed.value = false;
    });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View ref={canvasRef} style={styles.canvasContainer}>
          <Canvas style={styles.canvas}>
            <Group
              transform={[
                { translateX: screen.width / 2 - CIRCLE_SIZE / 2 },
                { translateY: screen.height / 2 - CIRCLE_SIZE / 2 },
              ]}
            >
              {/* Background circle */}
              <Circle
                cx={CENTER}
                cy={CENTER}
                r={CIRCLE_RADIUS}
                color="#F7F7F7"
                style="stroke"
                strokeWidth={CIRCLE_STROKE_WIDTH}
              >
                <Shadow dx={0} dy={12} blur={12} color="#00000030" inner />
                <Shadow dx={0} dy={-4} blur={4} color="#00000030" />
              </Circle>

              {/* Dots around the circle */}
              <Group>
                {dots.map((dot) => (
                  <Circle
                    key={dot.index}
                    cx={dot.x}
                    cy={dot.y}
                    r={DOT_SIZE / 2}
                    color={'#888888'}
                  />
                ))}
              </Group>

              <Circle
                cx={CENTER}
                cy={CENTER}
                r={CIRCLE_RADIUS - CIRCLE_STROKE_WIDTH / 2}
                color="#F7F7F7"
              >
                <Shadow dx={0} dy={-7} blur={3} color="#0000001F" inner />
                <Shadow dx={0} dy={7} blur={3} color="#ffffff" inner />
              </Circle>
              <Circle
                cx={knobX}
                cy={knobY}
                r={INNER_CIRCLE_STROKE_WIDTH / 2}
                color="#FF385C"
                style="fill"
              >
                <Shadow dx={0} dy={0} blur={10} color="#DC496A" shadowOnly />
              </Circle>
              <Group
                layer={
                  <Paint>
                    <Shadow dx={0} dy={0} blur={2} color="#000000D9" />
                    <Shadow dx={0} dy={0} blur={8} color="#F13758" />
                  </Paint>
                }
              >
                <Group
                  layer={
                    <Paint>
                      <Shadow dx={0} dy={0} blur={2.5} color="#F13758" inner />
                      <Shadow dx={0} dy={0} blur={2.5} color="#F13758" inner />
                      <Shadow dx={0} dy={0} blur={2.5} color="#F13758" inner />
                      <Shadow dx={0} dy={0} blur={2.5} color="#F13758" inner />
                      <Shadow dx={0} dy={0} blur={2.5} color="#F13758" inner />
                    </Paint>
                  }
                >
                  <Path
                    path={arcPath}
                    color="#FF385C"
                    style="stroke"
                    strokeWidth={INNER_CIRCLE_STROKE_WIDTH}
                    strokeCap="butt"
                  >
                    <RadialGradient
                      c={vec(CENTER, CENTER)}
                      r={CIRCLE_SIZE / 2}
                      colors={['#F04EA2', '#CD1D5E', '#D6215A', '#F13758']}
                      positions={[0.5, 0.75, 0.85, 1.0]}
                    />
                  </Path>

                  {/* Progress arc with flat start and rounded end */}

                  {/* Slightly rounded cap at the start position */}
                  <Path
                    path={usePathValue((path) => {
                      'worklet';
                      path.reset();

                      // Calculate dimensions for the rounded rectangle
                      const capWidth = INNER_CIRCLE_STROKE_WIDTH / 4;
                      const capHeight = INNER_CIRCLE_STROKE_WIDTH * 1.0003;
                      const cornerRadius = INNER_CIRCLE_STROKE_WIDTH / 8; // Adjust for desired roundness

                      // Position the cap at the start of the arc (top of circle)
                      const capX = CENTER - capWidth / 10;
                      const capY =
                        (CENTER - CIRCLE_RADIUS - capHeight / 2) * 1.15;

                      // Offset for the top-right corner to push it down
                      const topRightYOffset = INNER_CIRCLE_STROKE_WIDTH / 4;

                      // Draw rounded rectangle with adjusted top-right corner
                      path.moveTo(capX + cornerRadius, capY);
                      // Top edge (stops before the corner)
                      path.lineTo(capX + capWidth - cornerRadius, capY);
                      // Top-right corner (pushed down)
                      path.quadTo(
                        capX + capWidth,
                        capY,
                        capX + capWidth + 2,
                        capY + 0.1
                      );
                      // Right edge
                      path.lineTo(capX + capWidth, capY + capHeight);
                      // Bottom-right corner
                      path.quadTo(
                        capX + capWidth,
                        capY + capHeight,
                        capX + capWidth - cornerRadius,
                        capY + capHeight
                      );
                      // Bottom edge
                      path.lineTo(capX + cornerRadius, capY + capHeight);
                      // Bottom-left corner
                      path.quadTo(
                        capX,
                        capY + capHeight,
                        capX,
                        capY + capHeight - cornerRadius
                      );
                      // Left edge
                      path.lineTo(capX, capY + cornerRadius);
                      // Top-left corner
                      path.quadTo(capX, capY, capX + cornerRadius, capY);

                      path.close();
                      return path;
                    })}
                    color="#FF385C"
                    style="fill"
                  >
                    <RadialGradient
                      c={vec(CENTER, CENTER)}
                      r={CIRCLE_SIZE / 2}
                      colors={['#F04EA2', '#CD1D5E', '#D6215A', '#F13758']}
                      positions={[0.5, 0.75, 0.85, 1.0]}
                    />
                  </Path>
                  <Circle
                    cx={knobX}
                    cy={knobY}
                    r={INNER_CIRCLE_STROKE_WIDTH / 2}
                    color="#FF385C"
                    style="fill"
                  >
                    <RadialGradient
                      c={vec(CENTER, CENTER)}
                      r={CIRCLE_SIZE / 2}
                      colors={['#F04EA2', '#CD1D5E', '#D6215A', '#F13758']}
                      positions={[0.5, 0.75, 0.85, 1.0]}
                    />
                    {/* <Shadow dx={0} dy={0} blur={10} color="#DC496A" /> */}
                  </Circle>
                  {/* Rounded cap at the end (knob position) */}
                </Group>
              </Group>
              {/* White knob at the end of the progress */}
              <Circle
                cx={knobX}
                cy={knobY}
                r={knobSize}
                color="#F7F7F7"
                style="fill"
              />
            </Group>
          </Canvas>
        </View>
      </GestureDetector>

      {/* Display the current month value */}
      <View style={styles.valueContainer}>
        <Text style={styles.valueText}>{displayText}</Text>
        <Text style={styles.unitText}>months</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
  },
  canvasContainer: {
    width: '100%',
    height: '100%',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  valueContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 140,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: -30,
  },
  unitText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: -15,
  },
});
