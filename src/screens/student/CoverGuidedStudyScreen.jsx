import GuidedStudyScreen from './GuidedStudyScreen.jsx'
import { COVER_STUDY_PROGRAM } from '../../lib/coverStudyProgram.js'

export default function CoverGuidedStudyScreen(props) {
  return <GuidedStudyScreen {...props} program={COVER_STUDY_PROGRAM} />
}
