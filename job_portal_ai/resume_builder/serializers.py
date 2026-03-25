from rest_framework import serializers
from .models import (ResumeProfile, WorkExperience, Education,
                     Project, Skill, Certification, ResumeVersion, ATSResult)


class WorkExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WorkExperience
        fields = '__all__'
        extra_kwargs = {'resume': {'required': False}}


class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Education
        fields = '__all__'
        extra_kwargs = {'resume': {'required': False}}


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Project
        fields = '__all__'
        extra_kwargs = {'resume': {'required': False}}


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Skill
        fields = '__all__'
        extra_kwargs = {'resume': {'required': False}}


class CertificationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Certification
        fields = '__all__'
        extra_kwargs = {'resume': {'required': False}}


class ResumeVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ResumeVersion
        fields = ['id', 'label', 'template', 'created_at', 'snapshot']


class ATSResultSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ATSResult
        fields = '__all__'


class ResumeProfileSerializer(serializers.ModelSerializer):
    work_experiences = WorkExperienceSerializer(many=True, read_only=True)
    education        = EducationSerializer(many=True, read_only=True)
    projects         = ProjectSerializer(many=True, read_only=True)
    skills           = SkillSerializer(many=True, read_only=True)
    certifications   = CertificationSerializer(many=True, read_only=True)

    class Meta:
        model  = ResumeProfile
        fields = '__all__'


class ResumeProfileCreateSerializer(serializers.ModelSerializer):
    """Flat serializer for creating — no nested reads."""
    class Meta:
        model  = ResumeProfile
        fields = '__all__'