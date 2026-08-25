import GuidedStudyScreen from './GuidedStudyScreen.jsx'
import { PERSONALITY_STUDY_PROGRAM } from '../../lib/guidedLearningPrograms.js'

export default function PersonalityGuidedStudyScreen(props) {
  return <GuidedStudyScreen {...props} program={PERSONALITY_STUDY_PROGRAM} />
}
