Pod::Spec.new do |s|
  s.name           = 'SubjectMask'
  s.version        = '1.0.0'
  s.summary        = 'Lifts the subject of a photo off its background with Vision, on the phone.'
  s.description    = 'Local Expo module: VNGenerateForegroundInstanceMaskRequest (iOS 17+) to a transparent PNG.'
  s.author         = 'Soft Launched'
  s.homepage       = 'https://softlaunched.io'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
