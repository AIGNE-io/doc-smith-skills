{% if useImageToImage and existingImage %}
# Logo Editing Mode

Your task is to **modify an existing logo** based on the user's feedback and requirements.

**CRITICAL INSTRUCTIONS:**
1. **Use the existing logo as the primary reference** - maintain its core identity and structure
2. **Apply the requested modifications** carefully
3. **Maintain brand consistency** - keep recognizable elements unless specifically asked to change them
4. **Preserve quality** - ensure the output is clean and professional

**Modification Request:**
{{ desc }}

{% if feedback %}
**User Feedback:**
```
{{ feedback }}
```
{% endif %}

{% if style %}
**Target Style:** {{ style }}
- Apply the style characteristics while preserving brand identity
{% endif %}

{% if colorPreference %}
**Color Preference:** {{ colorPreference }}
{% endif %}

**Output Settings:**
- **Aspect Ratio:** {{ aspectRatio }}

**Existing Logo:**
[The existing logo image is provided as input]

**Your responsibilities:**
1. Analyze the existing logo's key elements
2. Apply the requested modifications precisely
3. Maintain professional quality and clarity
4. Ensure the result works at various sizes

{% else %}
# Logo Generation Mode

Your task is to create a professional brand logo based on the description below.

Please follow **all global rules, style guidelines, and aspect ratio logic** defined in the system prompt.

# Logo Parameters:
- **Description:** {{ desc }}
{% if name %}- **Brand Name:** {{ name }} (include this text in the logo design){% endif %}
{% if style %}- **Style:** {{ style }}{% endif %}
{% if colorPreference %}- **Color Preference:** {{ colorPreference }}{% endif %}
- **Aspect Ratio:** {{ aspectRatio }}

# Your responsibilities:
1. Create a unique, memorable logo design
2. Ensure the design is clean, professional, and versatile
3. Make sure it works at all sizes (favicon to banner)
{% if name %}4. Integrate the brand name "{{ name }}" clearly and readably{% endif %}
{% if style %}5. Apply the "{{ style }}" style characteristics{% endif %}
6. Use appropriate colors and contrast
7. Maintain visual balance and harmony

# Logo Description:
{{ desc }}

{% if name %}
# Brand Name Display:
The logo should prominently feature the name "{{ name }}".
- Make the name clearly readable
- Choose a font that matches the overall style
- Balance the text with any icon/symbol elements
{% endif %}

**Task:** Based on the description above, create a professional logo that clearly represents the brand identity. The design should be simple, memorable, and work across all applications.

{% endif %}
