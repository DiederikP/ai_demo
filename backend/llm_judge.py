"""
LLM Judge System - Evaluates LLM performance and provides confidence scores
Provides ability to second-guess LLM actions and give confidence levels
Tracks similar inputs to check for similar outputs
"""
import time
from typing import Dict, List, Optional, Any
from datetime import datetime
import hashlib
import json

class LLMJudge:
    """Evaluates LLM outputs for consistency, quality, and confidence"""
    
    def __init__(self):
        self.evaluation_history: List[Dict] = []
        # In-memory storage (in production, use database)
        self.settings = {
            'truncation_enabled': True,
            'prompt_density_multiplier': 1.0
        }
    
    def update_settings(self, truncation_enabled: bool = True, prompt_density_multiplier: float = 1.0):
        """Update judge settings"""
        self.settings['truncation_enabled'] = truncation_enabled
        self.settings['prompt_density_multiplier'] = prompt_density_multiplier
    
    def calculate_input_hash(self, input_data: Dict[str, Any]) -> str:
        """Create a hash of input data to identify similar inputs"""
        # Normalize input data for consistent hashing
        normalized = {
            'candidate_id': str(input_data.get('candidate_id', '')),
            'job_id': str(input_data.get('job_id', '')),
            'personas': sorted(input_data.get('personas', [])) if isinstance(input_data.get('personas'), list) else [],
            'company_note': str(input_data.get('company_note', ''))[:200] if input_data.get('company_note') else ''
        }
        # Create consistent hash
        hash_str = json.dumps(normalized, sort_keys=True)
        return hashlib.md5(hash_str.encode()).hexdigest()
    
    def evaluate_output_quality(self, output: str, expected_length: Optional[int] = None) -> Dict[str, float]:
        """Evaluate output quality metrics"""
        metrics = {
            'length_score': 1.0,
            'structure_score': 1.0,
            'completeness_score': 1.0
        }
        
        if not output or len(output.strip()) == 0:
            return {
                'length_score': 0.0,
                'structure_score': 0.0,
                'completeness_score': 0.0
            }
        
        # Length score (penalize if too short or too long)
        output_length = len(output)
        if expected_length:
            length_ratio = output_length / expected_length if expected_length > 0 else 1.0
            if length_ratio < 0.3:
                metrics['length_score'] = 0.4
            elif length_ratio < 0.5:
                metrics['length_score'] = 0.7
            elif length_ratio > 3.0:
                metrics['length_score'] = 0.6
            elif length_ratio > 2.0:
                metrics['length_score'] = 0.8
        else:
            if output_length < 50:
                metrics['length_score'] = 0.3
            elif output_length < 100:
                metrics['length_score'] = 0.6
            elif output_length > 10000:
                metrics['length_score'] = 0.7
        
        # Structure score (check for JSON, proper formatting)
        output_stripped = output.strip()
        if output_stripped.startswith('{') or output_stripped.startswith('['):
            try:
                json.loads(output_stripped)
                metrics['structure_score'] = 1.0
            except:
                metrics['structure_score'] = 0.7
        else:
            # Check for basic structure (sentences, paragraphs)
            sentences = [s.strip() for s in output.split('.') if s.strip()]
            paragraphs = [p.strip() for p in output.split('\n\n') if p.strip()]
            
            if len(sentences) > 3:
                metrics['structure_score'] = 0.9
            elif len(sentences) > 1:
                metrics['structure_score'] = 0.8
            else:
                metrics['structure_score'] = 0.6
            
            if len(paragraphs) > 1:
                metrics['structure_score'] = min(1.0, metrics['structure_score'] + 0.1)
        
        # Completeness score (check for truncation markers)
        truncation_markers = [
            '[Content truncated',
            '[Prompt truncated',
            '...',
            'truncated',
            '[incomplete'
        ]
        has_truncation = any(marker.lower() in output.lower() for marker in truncation_markers)
        
        if has_truncation:
            metrics['completeness_score'] = 0.4
        elif output_length < 100:
            metrics['completeness_score'] = 0.6
        elif output_length < 200:
            metrics['completeness_score'] = 0.8
        else:
            metrics['completeness_score'] = 1.0
        
        return metrics
    
    def compare_outputs(self, output1: str, output2: str) -> float:
        """Compare two outputs for similarity (0-1 scale) using word overlap"""
        if not output1 or not output2:
            return 0.0
        
        # Normalize outputs
        words1 = set(output1.lower().split())
        words2 = set(output2.lower().split())
        
        # Remove very common words
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'}
        words1 = words1 - common_words
        words2 = words2 - common_words
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        similarity = len(intersection) / len(union) if union else 0.0
        return similarity
    
    def calculate_confidence_score(
        self,
        output: str,
        timing: Dict[str, float],
        similar_outputs: List[str],
        quality_metrics: Dict[str, float]
    ) -> Dict[str, Any]:
        """Calculate overall confidence score for LLM output"""
        
        # Base confidence from quality metrics
        quality_score = (
            quality_metrics['length_score'] * 0.3 +
            quality_metrics['structure_score'] * 0.3 +
            quality_metrics['completeness_score'] * 0.4
        )
        
        # Consistency score (how similar to other outputs for similar inputs)
        consistency_score = 1.0
        if similar_outputs:
            similarities = [self.compare_outputs(output, similar) for similar in similar_outputs]
            avg_similarity = sum(similarities) / len(similarities) if similarities else 0.0
            # High similarity = high consistency = high confidence
            consistency_score = avg_similarity
        else:
            # No similar outputs to compare - neutral consistency
            consistency_score = 0.7
        
        # Timing score (reasonable response time)
        timing_score = 1.0
        total_time = timing.get('total', 0) or timing.get('duration', 0)
        if total_time > 120:  # More than 2 minutes - likely issues
            timing_score = 0.5
        elif total_time > 60:  # More than 60 seconds - slow
            timing_score = 0.7
        elif total_time > 30:  # More than 30 seconds - acceptable but slow
            timing_score = 0.9
        elif total_time < 1:  # Less than 1 second - might be cached/error
            timing_score = 0.8
        
        # Overall confidence (weighted average)
        confidence = (
            quality_score * 0.4 +
            consistency_score * 0.4 +
            timing_score * 0.2
        )
        
        # Ensure confidence is between 0 and 1
        confidence = max(0.0, min(1.0, confidence))
        
        return {
            'confidence_score': round(confidence, 3),
            'quality_score': round(quality_score, 3),
            'consistency_score': round(consistency_score, 3),
            'timing_score': round(timing_score, 3),
            'breakdown': {
                'quality': quality_metrics,
                'timing': timing,
                'similarity_to_others': round(consistency_score, 3),
                'similar_outputs_count': len(similar_outputs)
            }
        }
    
    def judge_llm_performance(
        self,
        input_data: Dict[str, Any],
        output: str,
        timing: Dict[str, float],
        historical_outputs: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Main judge function - evaluates LLM performance and second-guesses the output"""
        
        # Calculate input hash for finding similar inputs
        input_hash = self.calculate_input_hash(input_data)
        
        # Find similar historical outputs (for consistency checking)
        similar_outputs = []
        if historical_outputs:
            for hist in historical_outputs:
                hist_input_hash = self.calculate_input_hash(hist.get('input', {}))
                # Find outputs with same input hash (same inputs should give similar outputs)
                if hist_input_hash == input_hash:
                    similar_outputs.append(hist.get('output', ''))
        
        # Evaluate output quality
        quality_metrics = self.evaluate_output_quality(output)
        
        # Calculate confidence
        confidence = self.calculate_confidence_score(
            output, timing, similar_outputs, quality_metrics
        )
        
        # Store evaluation in history
        evaluation = {
            'timestamp': datetime.now().isoformat(),
            'input_hash': input_hash,
            'input': input_data,
            'output': output[:1000],  # Store first 1000 chars
            'timing': timing,
            'quality_metrics': quality_metrics,
            'confidence': confidence
        }
        
        self.evaluation_history.append(evaluation)
        
        # Keep only last 100 evaluations to prevent memory issues
        if len(self.evaluation_history) > 100:
            self.evaluation_history = self.evaluation_history[-100:]
        
        return {
            'evaluation_id': len(self.evaluation_history),
            'input_hash': input_hash,
            'confidence_score': confidence['confidence_score'],
            'quality_score': confidence['quality_score'],
            'consistency_score': confidence['consistency_score'],
            'timing_score': confidence['timing_score'],
            'breakdown': confidence['breakdown'],
            'similar_inputs_found': len(similar_outputs),
            'recommendations': self._generate_recommendations(confidence, quality_metrics, timing, len(similar_outputs))
        }
    
    def _generate_recommendations(
        self,
        confidence: Dict[str, Any],
        quality_metrics: Dict[str, float],
        timing: Dict[str, float],
        similar_inputs_count: int
    ) -> List[str]:
        """Generate recommendations based on evaluation"""
        recommendations = []
        
        conf_score = confidence['confidence_score']
        quality_score = confidence['quality_score']
        consistency_score = confidence['consistency_score']
        timing_score = confidence['timing_score']
        total_time = timing.get('total', 0) or timing.get('duration', 0)
        
        # Confidence recommendations
        if conf_score < 0.6:
            recommendations.append("⚠️ Laag vertrouwen - overweeg de output te herzien")
        elif conf_score < 0.8:
            recommendations.append("ℹ️ Gemiddeld vertrouwen - output is acceptabel maar niet optimaal")
        else:
            recommendations.append("✅ Hoog vertrouwen - output kwaliteit is goed")
        
        # Quality recommendations
        if quality_metrics['completeness_score'] < 0.6:
            recommendations.append("📝 Output lijkt onvolledig - overweeg truncatie uit te schakelen")
        
        if quality_metrics['length_score'] < 0.7:
            recommendations.append("📏 Ongebruikelijke output lengte - controleer of truncatie is opgetreden")
        
        if quality_metrics['structure_score'] < 0.7:
            recommendations.append("📋 Output structuur is niet optimaal - controleer prompt format")
        
        # Timing recommendations
        if total_time > 60:
            recommendations.append("⏱️ Hoge responstijd - overweeg optimalisatie van prompts of snellere modellen")
        
        # Consistency recommendations
        if similar_inputs_count > 0:
            if consistency_score < 0.6:
                recommendations.append("🔄 Lage consistentie met vergelijkbare inputs - model kan non-deterministisch zijn")
            elif consistency_score >= 0.8:
                recommendations.append("✅ Hoge consistentie met vergelijkbare inputs")
        else:
            recommendations.append("ℹ️ Geen vergelijkbare inputs gevonden voor consistentie check")
        
        return recommendations

# Global judge instance (singleton pattern)
_judge_instance = None

def get_judge() -> LLMJudge:
    """Get or create global judge instance"""
    global _judge_instance
    if _judge_instance is None:
        _judge_instance = LLMJudge()
    return _judge_instance
